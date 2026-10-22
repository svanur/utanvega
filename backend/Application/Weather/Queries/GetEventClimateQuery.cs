using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Weather.Queries;

// DTO returned to the frontend — historical climate normals ("usually"), not a forecast.
// Distinct from WeatherDto/GetTrailWeatherQuery (live forecast, "forecast") so the two can coexist
// on event-detail pages without confusing a visitor about which number is which.
// Lat/Lon are the coordinate the climate was actually resolved from (event.Location.Center — see
// the Handle method below) so the frontend can fall back to showing coordinates when the event has
// no linked Location to name (#1411).
// IsApproximate (#1414) flags when that coordinate came from a broad Location (Country/Area/
// Region) rather than a precise point — a Municipality/Place-type Location is never approximate.
public record ClimateDto(
    double AverageHigh,
    double AverageLow,
    double AveragePrecipitation,
    double PrecipitationChance,
    double AverageMaxWind,
    // #1446: average daily sunshine_duration (Open-Meteo reports seconds; converted to hours
    // here) across the same windowed samples the other averages use — a positive counterbalance
    // to PrecipitationChance, since a "60% rain chance" reads as rainier than it feels without
    // some indication of how much sun a visitor can also expect on the same days.
    double AverageSunshineHours,
    int YearsOfData,
    int TargetMonth,
    int TargetDay,
    double Lat,
    double Lon,
    bool IsApproximate
);

// MediatR query — TargetMonth/TargetDay are a concrete calendar date already resolved by the
// caller (event.displayDate ?? event.nextEditionDate), not a ScheduleRule re-interpreted here.
// Climate is event data, not trail data — an event's linked Location's center is the only
// coordinate source (#1460 dropped the GpxPointLat/Lng pin and the point-to-point start/finish
// split). An event with no linked Location shows no climate card at all.
public record GetEventClimateQuery(string Slug, int TargetMonth, int TargetDay) : IRequest<ClimateDto?>;

public class GetEventClimateQueryHandler : IRequestHandler<GetEventClimateQuery, ClimateDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GetEventClimateQueryHandler> _logger;

    private const int YearsOfHistory = 15;
    private const int WindowDays = 5;

    // #1446: a "rain day" is one with at least a full hour of measurable precipitation —
    // precipitation_hours is Open-Meteo's own count of hours within the day that crossed its
    // measurable-precipitation floor. Replaces the old precipitation_sum >= 0.1mm test, which
    // counted a single overnight drizzle the same as an all-day downpour and inflated
    // PrecipitationChance relative to what "rainy" means to a visitor planning a race.
    private const double MeasurableRainHours = 1;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromDays(7);

    public GetEventClimateQueryHandler(
        UtanvegaDbContext context,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<GetEventClimateQueryHandler> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ClimateDto?> Handle(GetEventClimateQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"climate:event:{request.Slug}:{request.TargetMonth}:{request.TargetDay}";
        if (_cache.TryGetValue(cacheKey, out ClimateDto? cached))
            return cached;

        var @event = await _context.Events
            .AsNoTracking()
            .Include(e => e.Location)
            .FirstOrDefaultAsync(e => e.Slug == request.Slug, cancellationToken);

        if (@event?.Location?.Center is not { } center)
            return null;

        var lat = center.Y;
        var lon = center.X;
        // #1414: only a broad Location (whole country/area/region) makes the climate an
        // estimate — a Municipality/Place-type Location is precise enough to trust as-is.
        var isApproximate = @event.Location.Type is LocationType.Country or LocationType.Area or LocationType.Region;

        var result = await FetchClimateAsync(lat, lon, request.TargetMonth, request.TargetDay, isApproximate, cancellationToken);

        if (result == null)
            return null;

        _cache.Set(cacheKey, result, CacheDuration);

        return result;
    }

    private async Task<ClimateDto?> FetchClimateAsync(double lat, double lon, int targetMonth, int targetDay, bool isApproximate, CancellationToken cancellationToken)
    {
        var currentYear = DateTime.UtcNow.Year;
        // Full past years only — the current year's target date may not have happened yet, which
        // would make the archive API return a short/empty window for it.
        var years = Enumerable.Range(currentYear - YearsOfHistory, YearsOfHistory).ToList();

        // #1356: one wide call spanning the earliest year's window through the latest year's
        // window, instead of YearsOfHistory separate narrow calls — Aggregate below does the
        // ±WindowDays filtering per year client-side, since the response is no longer pre-windowed.
        var firstYear = years[0];
        var firstDay = Math.Min(targetDay, DateTime.DaysInMonth(firstYear, targetMonth));
        var startDate = new DateTime(firstYear, targetMonth, firstDay).AddDays(-WindowDays);

        var lastYear = years[^1];
        var lastDay = Math.Min(targetDay, DateTime.DaysInMonth(lastYear, targetMonth));
        var endDate = new DateTime(lastYear, targetMonth, lastDay).AddDays(WindowDays);

        var response = await FetchArchiveAsync(lat, lon, startDate, endDate, cancellationToken);

        return Aggregate(response, years, targetMonth, targetDay, WindowDays, lat, lon, isApproximate);
    }

    // #1356: a single wide-range call (startDate..endDate spans every year's ±WindowDays window)
    // replaces the former YearsOfHistory per-year calls — Aggregate below does the per-year
    // windowing that FetchArchiveAsync's start_date/end_date used to do per call.
    private async Task<OpenMeteoArchiveResponse?> FetchArchiveAsync(double lat, double lon, DateTime startDate, DateTime endDate, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("OpenMeteo");
        var latStr = lat.ToString(CultureInfo.InvariantCulture);
        var lonStr = lon.ToString(CultureInfo.InvariantCulture);
        var startStr = startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var endStr = endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var url = $"https://archive-api.open-meteo.com/v1/archive?latitude={latStr}&longitude={lonStr}" +
                  $"&start_date={startStr}&end_date={endStr}" +
                  "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_hours,sunshine_duration,wind_speed_10m_max" +
                  "&timezone=Atlantic/Reykjavik&wind_speed_unit=ms";

        try
        {
            return await client.GetFromJsonAsync<OpenMeteoArchiveResponse>(url, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Open-Meteo archive API call failed for coordinates ({Lat}, {Lon}), range {Start}–{End}", lat, lon, startStr, endStr);
            return null;
        }
    }

    // Walks the single wide response's daily.Time array, keeping only the days that fall within
    // ±windowDays of (targetMonth, targetDay) in at least one of `years` — the response itself is
    // no longer pre-windowed per year (#1356), so that filtering happens here instead of in
    // FetchArchiveAsync's start_date/end_date. Internal (not private) so backend.Tests can exercise
    // the aggregation math directly, without mocking HTTP.
    internal static ClimateDto? Aggregate(OpenMeteoArchiveResponse? response, IReadOnlyList<int> years, int targetMonth, int targetDay, int windowDays, double lat, double lon, bool isApproximate = false)
    {
        var daily = response?.Daily;
        if (daily == null || daily.Time.Count == 0)
            return null;

        // One ±windowDays anniversary window per year — same day-of-month clamping (e.g. Feb 29
        // in a non-leap year) FetchArchiveAsync's start/end dates used before #1356.
        var yearWindows = years
            .Select(year =>
            {
                var day = Math.Min(targetDay, DateTime.DaysInMonth(year, targetMonth));
                var targetDate = new DateTime(year, targetMonth, day);
                return (Start: targetDate.AddDays(-windowDays), End: targetDate.AddDays(windowDays));
            })
            .ToList();

        var highs = new List<double>();
        var lows = new List<double>();
        var precipValues = new List<double>();
        var windValues = new List<double>();
        var sunshineHoursValues = new List<double>();
        var precipHoursSamples = 0;
        var wetDays = 0;
        var yearsWithData = new HashSet<int>();

        for (var i = 0; i < daily.Time.Count; i++)
        {
            if (!DateTime.TryParse(daily.Time[i], CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                continue;

            // A day only counts if it falls inside some year's window — the wide response also
            // includes the days between windows, which belong to no year and must be excluded.
            var windowIndex = yearWindows.FindIndex(w => date >= w.Start && date <= w.End);
            if (windowIndex < 0)
                continue;

            yearsWithData.Add(windowIndex);

            var hi = daily.Temperature2mMax.ElementAtOrDefault(i);
            var lo = daily.Temperature2mMin.ElementAtOrDefault(i);
            var precip = daily.PrecipitationSum.ElementAtOrDefault(i);
            var precipHours = daily.PrecipitationHours.ElementAtOrDefault(i);
            var sunshineSeconds = daily.SunshineDuration.ElementAtOrDefault(i);
            var wind = daily.WindSpeed10mMax.ElementAtOrDefault(i);

            if (hi.HasValue) highs.Add(hi.Value);
            if (lo.HasValue) lows.Add(lo.Value);
            if (wind.HasValue) windValues.Add(wind.Value);
            if (precip.HasValue) precipValues.Add(precip.Value);
            // #1446: sunshine_duration arrives in seconds — hours is the unit ClimateDto and the
            // frontend both work in, matching AverageMaxWind/AveragePrecipitation already being
            // pre-converted to their display units here rather than in the frontend.
            if (sunshineSeconds.HasValue) sunshineHoursValues.Add(sunshineSeconds.Value / 3600.0);
            if (precipHours.HasValue)
            {
                precipHoursSamples++;
                if (precipHours.Value >= MeasurableRainHours) wetDays++;
            }
        }

        if (highs.Count == 0 || lows.Count == 0 || yearsWithData.Count == 0)
            return null;

        return new ClimateDto(
            Math.Round(highs.Average(), 1),
            Math.Round(lows.Average(), 1),
            Math.Round(precipValues.Count > 0 ? precipValues.Average() : 0, 1),
            Math.Round(precipHoursSamples > 0 ? (double)wetDays / precipHoursSamples : 0, 2),
            Math.Round(windValues.Count > 0 ? windValues.Average() : 0, 1),
            Math.Round(sunshineHoursValues.Count > 0 ? sunshineHoursValues.Average() : 0, 1),
            yearsWithData.Count,
            targetMonth,
            targetDay,
            lat,
            lon,
            isApproximate
        );
    }
}

// Open-Meteo archive API response models — a subset of GetTrailWeatherQuery's OpenMeteoResponse
// shape, scoped to the daily aggregates this query needs. Values are nullable because Open-Meteo
// returns null (not 0) for days it has no reanalysis data for yet.
public class OpenMeteoArchiveResponse
{
    [JsonPropertyName("daily")]
    public OpenMeteoArchiveDaily? Daily { get; set; }
}

public class OpenMeteoArchiveDaily
{
    [JsonPropertyName("time")]
    public List<string> Time { get; set; } = [];

    [JsonPropertyName("temperature_2m_max")]
    public List<double?> Temperature2mMax { get; set; } = [];

    [JsonPropertyName("temperature_2m_min")]
    public List<double?> Temperature2mMin { get; set; } = [];

    [JsonPropertyName("precipitation_sum")]
    public List<double?> PrecipitationSum { get; set; } = [];

    // #1446: hours within the day that crossed Open-Meteo's own measurable-precipitation floor —
    // the "rain day" test in Aggregate keys off this, not PrecipitationSum, so a single
    // overnight-drizzle millimeter no longer counts the same as an all-day downpour.
    [JsonPropertyName("precipitation_hours")]
    public List<double?> PrecipitationHours { get; set; } = [];

    // #1446: seconds of actual sunshine (not daylight length) — averaged and converted to hours
    // in Aggregate for ClimateDto.AverageSunshineHours, the positive counterbalance to
    // PrecipitationChance.
    [JsonPropertyName("sunshine_duration")]
    public List<double?> SunshineDuration { get; set; } = [];

    [JsonPropertyName("wind_speed_10m_max")]
    public List<double?> WindSpeed10mMax { get; set; } = [];
}

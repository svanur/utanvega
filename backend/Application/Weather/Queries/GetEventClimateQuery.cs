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
// Lat/Lon are the coordinate the climate was actually resolved from (GpxPointLat/Lng, or
// Location.Center as fallback — see the Handle method below) so the frontend can fall back to
// showing coordinates when the event has no linked Location to name (#1411).
// IsApproximate (#1414) flags when that coordinate came from a broad Location (Country/Area/
// Region) rather than a precise point — a GPX point, or a Municipality/Place-type Location, is
// never approximate.
public record ClimateDto(
    double AverageHigh,
    double AverageLow,
    double AveragePrecipitation,
    double PrecipitationChance,
    double AverageMaxWind,
    int YearsOfData,
    int TargetMonth,
    int TargetDay,
    double Lat,
    double Lon,
    bool IsApproximate
);

// MediatR query — TargetMonth/TargetDay are a concrete calendar date already resolved by the
// caller (event.displayDate ?? event.nextEditionDate), not a ScheduleRule re-interpreted here.
// Climate is event data, not trail data — an event's own GpxPointLat/Lng (falling back to its
// Location's center) is the coordinate source, not any race's attached trail. An event with no
// trail at all can still show its climate card.
public record GetEventClimateQuery(string Slug, int TargetMonth, int TargetDay) : IRequest<ClimateDto?>;

public class GetEventClimateQueryHandler : IRequestHandler<GetEventClimateQuery, ClimateDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GetEventClimateQueryHandler> _logger;

    private const int YearsOfHistory = 15;
    private const int WindowDays = 5;

    // Open-Meteo reports precipitation in mm; below this a "rainy" day is really just dew/mist noise.
    private const double MeasurablePrecipitationMm = 0.1;

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

        if (@event == null)
            return null;

        // Event's own GPS point first, Location's center as fallback — never a race's trail.
        double lat, lon;
        bool isApproximate;
        if (@event.GpxPointLat is { } gpxLat && @event.GpxPointLng is { } gpxLng)
        {
            lat = gpxLat;
            lon = gpxLng;
            isApproximate = false;
        }
        else if (@event.Location?.Center is { } center)
        {
            lat = center.Y;
            lon = center.X;
            // #1414: only a broad Location (whole country/area/region) makes the climate an
            // estimate — a Municipality/Place-type Location is precise enough to trust as-is.
            isApproximate = @event.Location.Type is LocationType.Country or LocationType.Area or LocationType.Region;
        }
        else
        {
            return null;
        }

        var currentYear = DateTime.UtcNow.Year;
        // Full past years only — the current year's target date may not have happened yet, which
        // would make the archive API return a short/empty window for it.
        var years = Enumerable.Range(currentYear - YearsOfHistory, YearsOfHistory).ToList();

        // #1356: one wide call spanning the earliest year's window through the latest year's
        // window, instead of YearsOfHistory separate narrow calls — Aggregate below does the
        // ±WindowDays filtering per year client-side, since the response is no longer pre-windowed.
        var firstYear = years[0];
        var firstDay = Math.Min(request.TargetDay, DateTime.DaysInMonth(firstYear, request.TargetMonth));
        var startDate = new DateTime(firstYear, request.TargetMonth, firstDay).AddDays(-WindowDays);

        var lastYear = years[^1];
        var lastDay = Math.Min(request.TargetDay, DateTime.DaysInMonth(lastYear, request.TargetMonth));
        var endDate = new DateTime(lastYear, request.TargetMonth, lastDay).AddDays(WindowDays);

        var response = await FetchArchiveAsync(lat, lon, startDate, endDate, cancellationToken);

        var result = Aggregate(response, years, request.TargetMonth, request.TargetDay, WindowDays, lat, lon, isApproximate);
        if (result == null)
            return null;

        _cache.Set(cacheKey, result, CacheDuration);

        return result;
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
                  "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
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
            var wind = daily.WindSpeed10mMax.ElementAtOrDefault(i);

            if (hi.HasValue) highs.Add(hi.Value);
            if (lo.HasValue) lows.Add(lo.Value);
            if (wind.HasValue) windValues.Add(wind.Value);
            if (precip.HasValue)
            {
                precipValues.Add(precip.Value);
                if (precip.Value >= MeasurablePrecipitationMm) wetDays++;
            }
        }

        if (highs.Count == 0 || lows.Count == 0 || yearsWithData.Count == 0)
            return null;

        return new ClimateDto(
            Math.Round(highs.Average(), 1),
            Math.Round(lows.Average(), 1),
            Math.Round(precipValues.Count > 0 ? precipValues.Average() : 0, 1),
            Math.Round(precipValues.Count > 0 ? (double)wetDays / precipValues.Count : 0, 2),
            Math.Round(windValues.Count > 0 ? windValues.Average() : 0, 1),
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

    [JsonPropertyName("wind_speed_10m_max")]
    public List<double?> WindSpeed10mMax { get; set; } = [];
}

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
public record ClimateDto(
    double AverageHigh,
    double AverageLow,
    double AveragePrecipitation,
    double PrecipitationChance,
    double AverageMaxWind,
    int YearsOfData,
    int TargetMonth,
    int TargetDay
);

// MediatR query — TargetMonth/TargetDay are a concrete calendar date already resolved by the
// caller (event.displayDate ?? event.nextEditionDate), not a ScheduleRule re-interpreted here.
public record GetTrailClimateQuery(string Slug, int TargetMonth, int TargetDay) : IRequest<ClimateDto?>;

public class GetTrailClimateQueryHandler : IRequestHandler<GetTrailClimateQuery, ClimateDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GetTrailClimateQueryHandler> _logger;

    private const int YearsOfHistory = 15;
    private const int WindowDays = 5;

    // Open-Meteo reports precipitation in mm; below this a "rainy" day is really just dew/mist noise.
    private const double MeasurablePrecipitationMm = 0.1;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromDays(7);

    public GetTrailClimateQueryHandler(
        UtanvegaDbContext context,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<GetTrailClimateQueryHandler> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ClimateDto?> Handle(GetTrailClimateQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"climate:{request.Slug}:{request.TargetMonth}:{request.TargetDay}";
        if (_cache.TryGetValue(cacheKey, out ClimateDto? cached))
            return cached;

        var trail = await _context.Trails
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == request.Slug && (t.Status == TrailStatus.Published || t.Status == TrailStatus.EventOnly), cancellationToken);

        if (trail?.GpxData == null)
            return null;

        var coords = trail.GpxData.Coordinates;
        if (coords.Length == 0)
            return null;

        var startCoord = coords[0];

        var currentYear = DateTime.UtcNow.Year;
        // Full past years only — the current year's target date may not have happened yet, which
        // would make the archive API return a short/empty window for it.
        var years = Enumerable.Range(currentYear - YearsOfHistory, YearsOfHistory);

        var fetchTasks = years.Select(year => FetchArchiveAsync(startCoord.Y, startCoord.X, year, request.TargetMonth, request.TargetDay, cancellationToken));
        var responses = await Task.WhenAll(fetchTasks);

        var result = Aggregate(responses, request.TargetMonth, request.TargetDay);
        if (result == null)
            return null;

        _cache.Set(cacheKey, result, CacheDuration);

        return result;
    }

    private async Task<OpenMeteoArchiveResponse?> FetchArchiveAsync(double lat, double lon, int year, int targetMonth, int targetDay, CancellationToken cancellationToken)
    {
        var day = Math.Min(targetDay, DateTime.DaysInMonth(year, targetMonth));
        var targetDate = new DateTime(year, targetMonth, day);
        var startDate = targetDate.AddDays(-WindowDays);
        var endDate = targetDate.AddDays(WindowDays);

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
            _logger.LogWarning(ex, "Open-Meteo archive API call failed for coordinates ({Lat}, {Lon}), year {Year}", lat, lon, year);
            return null;
        }
    }

    // Flattens every successful year's daily window into running totals. Internal (not private) so
    // backend.Tests can exercise the aggregation math directly, without mocking HTTP.
    internal static ClimateDto? Aggregate(IEnumerable<OpenMeteoArchiveResponse?> responses, int targetMonth, int targetDay)
    {
        var highs = new List<double>();
        var lows = new List<double>();
        var precipValues = new List<double>();
        var windValues = new List<double>();
        var wetDays = 0;
        var yearsWithData = 0;

        foreach (var response in responses)
        {
            var daily = response?.Daily;
            if (daily == null || daily.Time.Count == 0)
                continue;

            yearsWithData++;

            for (var i = 0; i < daily.Time.Count; i++)
            {
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
        }

        if (highs.Count == 0 || lows.Count == 0 || yearsWithData == 0)
            return null;

        return new ClimateDto(
            Math.Round(highs.Average(), 1),
            Math.Round(lows.Average(), 1),
            Math.Round(precipValues.Count > 0 ? precipValues.Average() : 0, 1),
            Math.Round(precipValues.Count > 0 ? (double)wetDays / precipValues.Count : 0, 2),
            Math.Round(windValues.Count > 0 ? windValues.Average() : 0, 1),
            yearsWithData,
            targetMonth,
            targetDay
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

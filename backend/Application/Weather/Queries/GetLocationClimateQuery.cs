using System.Globalization;
using System.Net.Http.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Weather.Queries;

// #1801: a second climate-normals entry point alongside GetEventClimateQuery, keyed on a Location
// slug instead of an Event slug — for /locations/<slug>, which has no linked Event to walk through
// for a coordinate. Resolves Location.Center directly (same slug-lookup shape as
// GetLocationBySlugQuery) and reuses GetEventClimateQuery's public ClimateDto record plus its
// internal static Aggregate (the aggregation math itself is identical either way — only how the
// coordinate and isApproximate flag get resolved differs) rather than duplicating either.
// GetEventClimateQuery.cs is explicitly out of scope for this change, so the small
// archive-fetching wrapper around Aggregate (FetchClimateAsync/FetchArchiveAsync) is mirrored here
// rather than extracted into a shared helper — only the two genuinely-shared, already-reusable
// pieces (ClimateDto, Aggregate) are reused directly.
public record GetLocationClimateQuery(string Slug, int TargetMonth, int TargetDay) : IRequest<ClimateDto?>;

public class GetLocationClimateQueryHandler : IRequestHandler<GetLocationClimateQuery, ClimateDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GetLocationClimateQueryHandler> _logger;

    private const int YearsOfHistory = 15;
    private const int WindowDays = 5;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromDays(7);

    public GetLocationClimateQueryHandler(
        UtanvegaDbContext context,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<GetLocationClimateQueryHandler> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ClimateDto?> Handle(GetLocationClimateQuery request, CancellationToken cancellationToken)
    {
        // Location-scoped cache key — deliberately not shared with GetEventClimateQuery's
        // "climate:event:{slug}:..." format, since an event slug and a location slug resolve
        // through different lookup paths and could theoretically collide on the same raw string.
        var cacheKey = $"climate:location:{request.Slug}:{request.TargetMonth}:{request.TargetDay}";
        if (_cache.TryGetValue(cacheKey, out ClimateDto? cached))
            return cached;

        var location = await _context.Locations
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Slug == request.Slug, cancellationToken);

        if (location?.Center is not { } center)
            return null;

        var lat = center.Y;
        var lon = center.X;
        // Same #1414 rule GetEventClimateQueryHandler applies: only a broad Location (whole
        // country/area/region) makes the climate an estimate — a Municipality/Place-type Location
        // is precise enough to trust as-is.
        var isApproximate = location.Type is LocationType.Country or LocationType.Area or LocationType.Region;

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

        // One wide call spanning the earliest year's window through the latest year's window —
        // same #1356 approach GetEventClimateQueryHandler uses; Aggregate (reused below) does the
        // ±WindowDays filtering per year client-side.
        var firstYear = years[0];
        var firstDay = Math.Min(targetDay, DateTime.DaysInMonth(firstYear, targetMonth));
        var startDate = new DateTime(firstYear, targetMonth, firstDay).AddDays(-WindowDays);

        var lastYear = years[^1];
        var lastDay = Math.Min(targetDay, DateTime.DaysInMonth(lastYear, targetMonth));
        var endDate = new DateTime(lastYear, targetMonth, lastDay).AddDays(WindowDays);

        var response = await FetchArchiveAsync(lat, lon, startDate, endDate, cancellationToken);

        // Aggregate is GetEventClimateQueryHandler's internal static aggregation math — reused
        // as-is rather than duplicated, since the arithmetic doesn't depend on whether the
        // coordinate came from an Event's Location or a Location directly.
        return GetEventClimateQueryHandler.Aggregate(response, years, targetMonth, targetDay, WindowDays, lat, lon, isApproximate);
    }

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
}

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
// #1817: the archive-fetching wrapper around Aggregate (FetchClimateAsync/FetchArchiveAsync),
// mirrored here by #1801 pending extraction, now lives once in OpenMeteoClimateFetcher and is
// called from here and from GetEventClimateQueryHandler.
public record GetLocationClimateQuery(string Slug, int TargetMonth, int TargetDay) : IRequest<ClimateDto?>;

public class GetLocationClimateQueryHandler : IRequestHandler<GetLocationClimateQuery, ClimateDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GetLocationClimateQueryHandler> _logger;

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

        // #1817: shared with GetEventClimateQueryHandler via OpenMeteoClimateFetcher — see that
        // class for the fetch/aggregate pipeline (this used to be a mirrored private copy).
        var result = await OpenMeteoClimateFetcher.FetchClimateAsync(_httpClientFactory, _logger, lat, lon, request.TargetMonth, request.TargetDay, isApproximate, cancellationToken);

        if (result == null)
            return null;

        _cache.Set(cacheKey, result, CacheDuration);

        return result;
    }
}

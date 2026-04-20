using Microsoft.Extensions.Caching.Memory;

namespace Utanvega.Backend.Application.Caching;

public class CacheInvalidator : ICacheInvalidator
{
    private readonly IMemoryCache _cache;

    public CacheInvalidator(IMemoryCache cache)
    {
        _cache = cache;
    }

    public void InvalidateTrail(string? slug = null)
    {
        // Clear all trail list variants
        _cache.Remove(CacheKeys.Trails(false, true));
        _cache.Remove(CacheKeys.Trails(false, false));
        _cache.Remove(CacheKeys.Trails(true, false));
        _cache.Remove(CacheKeys.Trails(true, true));
        _cache.Remove(CacheKeys.GeometriesAll);
        // Trail count changes affect location tree
        _cache.Remove(CacheKeys.LocationTree);

        if (slug is not null)
        {
            _cache.Remove(CacheKeys.Trail(slug));
            _cache.Remove(CacheKeys.Geometry(slug));
            _cache.Remove(CacheKeys.Gpx(slug));
        }
    }

    public void InvalidateLocation(string? slug = null)
    {
        _cache.Remove(CacheKeys.LocationsAll);
        _cache.Remove(CacheKeys.LocationTree);
        // Location changes can affect trail DTOs (location info on trails)
        _cache.Remove(CacheKeys.Trails(false, true));
        _cache.Remove(CacheKeys.Trails(false, false));
        _cache.Remove(CacheKeys.Trails(true, false));
        _cache.Remove(CacheKeys.Trails(true, true));

        if (slug is not null)
            _cache.Remove(CacheKeys.Location(slug));
    }

    public void InvalidateCompetition(string? slug = null)
    {
        _cache.Remove(CacheKeys.Competitions(false));
        _cache.Remove(CacheKeys.Competitions(true));

        if (slug is not null)
            _cache.Remove(CacheKeys.Competition(slug));
    }
}

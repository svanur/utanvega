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
        _cache.Remove(CacheKeys.Trails(false, true));
        _cache.Remove(CacheKeys.Trails(false, false));
        _cache.Remove(CacheKeys.Trails(true, false));
        _cache.Remove(CacheKeys.Trails(true, true));
        _cache.Remove(CacheKeys.GeometriesAll);
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
        _cache.Remove(CacheKeys.LocationCentersAll);
        _cache.Remove(CacheKeys.Trails(false, true));
        _cache.Remove(CacheKeys.Trails(false, false));
        _cache.Remove(CacheKeys.Trails(true, false));
        _cache.Remove(CacheKeys.Trails(true, true));

        if (slug is not null)
            _cache.Remove(CacheKeys.Location(slug));
    }

    public void InvalidateEvent(string? slug = null)
    {
        _cache.Remove(CacheKeys.Events(false));
        _cache.Remove(CacheKeys.Events(true));
        _cache.Remove(CacheKeys.EditionsHistoryYears);

        // Bump the version token so all cached calendar entries are effectively invalidated.
        var current = _cache.GetOrCreate(CacheKeys.EventVersion, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });
        _cache.Set(CacheKeys.EventVersion, current + 1,
            new MemoryCacheEntryOptions { Priority = CacheItemPriority.NeverRemove });

        if (slug is not null)
        {
            _cache.Remove(CacheKeys.Event(slug, false));
            _cache.Remove(CacheKeys.Event(slug, true));
        }
    }

    public void InvalidateLeaderboard(string slug)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var versionKey = CacheKeys.LeaderboardVersion(normalizedSlug);
        var current = _cache.GetOrCreate(versionKey, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });
        _cache.Set(versionKey, current + 1,
            new MemoryCacheEntryOptions { Priority = CacheItemPriority.NeverRemove });
    }
}

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

        // Bump the version token so all cached duplicate-scan responses are effectively invalidated.
        // #1265: atomic bump — see CacheVersionBumper for why the old read-then-write lost increments.
        CacheVersionBumper.Bump(_cache, CacheKeys.TrailDuplicatesVersion);

        if (slug is not null)
        {
            _cache.Remove(CacheKeys.Trail(slug));
            _cache.Remove(CacheKeys.Geometry(slug));
            // #1173: Gpx is keyed per-lang now — evict both variants so a trail edit doesn't
            // leave the other lang's GPX cached under a stale key.
            _cache.Remove(CacheKeys.Gpx(slug, false));
            _cache.Remove(CacheKeys.Gpx(slug, true));
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
        // #1265: atomic bump — see CacheVersionBumper for why the old read-then-write lost increments.
        CacheVersionBumper.Bump(_cache, CacheKeys.EventVersion);

        if (slug is not null)
        {
            _cache.Remove(CacheKeys.Event(slug, false));
            _cache.Remove(CacheKeys.Event(slug, true));
            // #1562: GetPublicEventQuery's own key — separate from Event(slug, false) above,
            // which no longer has a live caller but stays removed here for safety.
            _cache.Remove(CacheKeys.EventPublic(slug));
        }
    }

    public void InvalidateOrganizer(string slug)
    {
        _cache.Remove(CacheKeys.Organizer(slug));
    }

    public void InvalidateLeaderboard(string slug)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var versionKey = CacheKeys.LeaderboardVersion(normalizedSlug);
        // #1265: atomic bump — see CacheVersionBumper for why the old read-then-write lost increments.
        CacheVersionBumper.Bump(_cache, versionKey);
    }
}

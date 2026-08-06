namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// Centralized cache key definitions. Used by both CachingBehavior (via ICacheable)
/// and CacheInvalidator (for targeted eviction on writes).
/// </summary>
public static class CacheKeys
{
    // Trails
    public static string Trails(bool includeArchived, bool publishedOnly) =>
        $"trails:{includeArchived}:{publishedOnly}";
    public static string Trail(string slug) => $"trail:{slug}";
    public static string Geometry(string slug) => $"geometry:{slug}";
    public static string GeometriesAll => "geometries:all";
    public static string Gpx(string slug) => $"gpx:{slug}";
    public static string Trending(int count, int days) => $"trending:{count}:{days}";

    // Activities
    public static string LeaderboardVersion(string trailSlug) => $"leaderboard:{trailSlug}:version";
    public static string Leaderboard(string trailSlug, int version, int limit) => $"leaderboard:{trailSlug}:{version}:{limit}";

    // Locations
    public static string LocationsAll => "locations:all";
    public static string LocationTree => "locations:tree";
    public static string Location(string slug) => $"location:{slug}";

    // Events
    public static string Events(bool includeHidden) => $"events:{includeHidden}";
    public static string Event(string slug) => $"event:{slug}";

    /// <summary>
    /// Calendar entries include the event version so bumping the version
    /// effectively orphans all cached calendar responses without needing key enumeration.
    /// </summary>
    public static string Calendar(int version, DateOnly from, DateOnly to) =>
        $"calendar:{version}:{from:yyyy-MM-dd}:{to:yyyy-MM-dd}";

    /// <summary>Version token incremented on every event/edition/race write.</summary>
    public static string EventVersion => "event:version";

    // Analytics
    public static string Analytics => "analytics";
}

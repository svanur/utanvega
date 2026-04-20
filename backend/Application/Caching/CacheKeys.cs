namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// Centralized cache key definitions. Used by both CachingBehavior (via ICacheable)
/// and CacheInvalidator (for targeted eviction on writes).
/// </summary>
public static class CacheKeys
{
    // Trails
    public static string Trails(bool includeDeleted, bool publishedOnly) =>
        $"trails:{includeDeleted}:{publishedOnly}";
    public static string Trail(string slug) => $"trail:{slug}";
    public static string Geometry(string slug) => $"geometry:{slug}";
    public static string GeometriesAll => "geometries:all";
    public static string Gpx(string slug) => $"gpx:{slug}";
    public static string Trending(int count, int days) => $"trending:{count}:{days}";

    // Locations
    public static string LocationsAll => "locations:all";
    public static string LocationTree => "locations:tree";
    public static string Location(string slug) => $"location:{slug}";

    // Competitions
    public static string Competitions(bool includeHidden) => $"competitions:{includeHidden}";
    public static string Competition(string slug) => $"competition:{slug}";

    /// <summary>
    /// Calendar entries include the competition version so bumping the version
    /// effectively orphans all cached calendar responses without needing key enumeration.
    /// </summary>
    public static string Calendar(int version, DateOnly from, DateOnly to) =>
        $"calendar:{version}:{from:yyyy-MM-dd}:{to:yyyy-MM-dd}";

    /// <summary>Version token that is incremented on every competition/race write.</summary>
    public static string CompetitionVersion => "competition:version";
}

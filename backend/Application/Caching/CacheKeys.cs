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
    public static string Calendar(DateOnly from, DateOnly to) => $"calendar:{from}:{to}";
}

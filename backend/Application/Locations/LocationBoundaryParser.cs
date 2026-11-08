using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace Utanvega.Backend.Application.Locations;

/// <summary>
/// Shared GeoJSON-to-Polygon parsing/validation for Location.Boundary (#1705), used by both
/// CreateLocationCommandValidator/UpdateLocationCommandValidator (reject bad input) and the
/// corresponding command handlers (parse the already-validated input). Kept in one place so the
/// two call sites can never drift on what counts as an acceptable boundary.
/// </summary>
public static class LocationBoundaryParser
{
    /// <summary>
    /// Parses <paramref name="geoJson"/> into a Polygon with SRID 4326. Fails (returns false) when
    /// the input isn't valid GeoJSON, doesn't resolve to a Polygon geometry type, or the polygon is
    /// not simple (self-intersecting ring).
    /// </summary>
    public static bool TryParse(string geoJson, out Polygon? polygon, out string? error)
    {
        Geometry? geometry;
        try
        {
            geometry = new GeoJsonReader().Read<Geometry>(geoJson);
        }
        catch (Exception)
        {
            polygon = null;
            error = "BoundaryGeoJson must be valid GeoJSON.";
            return false;
        }

        if (geometry is not Polygon parsed)
        {
            polygon = null;
            error = "BoundaryGeoJson must be a Polygon.";
            return false;
        }

        // IsSimple catches a self-intersecting ring directly; IsValid catches the broader OGC
        // validity rules (e.g. holes outside the shell) that a self-intersecting ring also fails.
        if (!parsed.IsSimple || !parsed.IsValid)
        {
            polygon = null;
            error = "BoundaryGeoJson polygon must be simple (non-self-intersecting).";
            return false;
        }

        parsed.SRID = 4326;
        polygon = parsed;
        error = null;
        return true;
    }
}

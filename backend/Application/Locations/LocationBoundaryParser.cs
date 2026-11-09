using System.Text;
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
    // #1714: both caps are generous but bounded — chosen to comfortably admit the 4 Greater
    // Reykjavík municipality boundaries already imported by PR #1713 (largest so far: Reykjavík
    // itself at ~7.6 KB / 403 vertices) while still bounding the worst case. Create/UpdateLocation
    // sit behind [Authorize(Policy = "AdminOnly")], so this isn't externally exploitable today —
    // it's a defence-in-depth cap flagged as a follow-up in #1705 / PR #1713, not a response to an
    // observed attack.
    private const int MaxPayloadLength = 500_000;
    private const int MaxVertexCount = 50_000;

    /// <summary>
    /// Parses <paramref name="geoJson"/> into a Polygon with SRID 4326. Fails (returns false) when
    /// the input isn't valid GeoJSON, doesn't resolve to a Polygon geometry type, the polygon is
    /// not simple (self-intersecting ring), or the raw payload/vertex count exceeds the caps above.
    /// </summary>
    public static bool TryParse(string geoJson, out Polygon? polygon, out string? error)
    {
        // #1736: byte length, not geoJson.Length (UTF-16 char count) — a payload padded with
        // multi-byte UTF-8 characters can stay under the char cap while exceeding the byte size
        // the cap was meant to bound.
        if (Encoding.UTF8.GetByteCount(geoJson) > MaxPayloadLength)
        {
            polygon = null;
            error = $"BoundaryGeoJson must not exceed {MaxPayloadLength:N0} bytes.";
            return false;
        }

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

        // NumPoints sums the exterior ring plus every interior ring (hole) — matches the vertex
        // count the import tooling already logs (scripts/import-municipality-boundaries).
        if (parsed.NumPoints > MaxVertexCount)
        {
            polygon = null;
            error = $"BoundaryGeoJson polygon must not exceed {MaxVertexCount:N0} vertices.";
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

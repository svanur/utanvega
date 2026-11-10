// #1764: pure, standalone-testable extraction of the MultiPolygon → Polygon reduction logic this
// script needs for IS8 (Suðurland) and IS6 (Norðurland eystra), both of which come back as a
// GeoJSON MultiPolygon from the committed landsvaedi-is.json — the same algorithm
// scripts/import-municipality-boundaries/Program.cs already uses for the 4 Greater Reykjavík
// municipalities (ReduceToSinglePolygon), kept here as its own file (rather than inlined into
// Program.cs's top-level statements, like the municipality script did) specifically so
// backend.Tests can compile this one file directly (see backend.Tests.csproj's linked Compile
// item) and cover it with xUnit — this script project itself is never wired into the backend web
// app's build/runtime or CI, only this one pure-geometry file is pulled into the test assembly.
//
// Algorithm (identical reasoning to the municipality script):
//   1. Already a Polygon → return as-is, nothing to reduce.
//   2. Union() across all parts of a MultiPolygon. If the parts touch/overlap, this collapses to
//      a single simply-connected Polygon and that is the answer — no data dropped.
//   3. If still a MultiPolygon after Union() (genuinely disjoint parts, e.g. offshore islands),
//      keep the one part that Contains() a caller-supplied reference point known to be on the
//      mainland, and discard the rest. "Largest area" was rejected as the selection rule by the
//      municipality script's precedent (its largest-area part was not reliably the populated
//      mainland one) — "contains the reference point" is deliberate and carried over here.

using NetTopologySuite.Geometries;

namespace Utanvega.Scripts.ImportLandsvaediRegions;

public static class MultiPolygonReducer
{
    /// <summary>
    /// Reduces <paramref name="geometry"/> (a Polygon or MultiPolygon) to a single Polygon.
    /// <paramref name="label"/> is only used to make <paramref name="logMessage"/> and any thrown
    /// exception's message readable (e.g. "Suðurland (IS8)"). <paramref name="referenceLng"/>/
    /// <paramref name="referenceLat"/> must be a point known to lie on the mainland part to keep.
    /// Throws <see cref="InvalidOperationException"/> if the geometry is neither a Polygon nor a
    /// MultiPolygon, or if the reference point lands outside every disjoint part (the caller's
    /// reference point needs updating before re-running).
    /// </summary>
    public static Polygon ReduceToMainlandPolygon(
        Geometry geometry, string label, double referenceLng, double referenceLat, out string logMessage)
    {
        if (geometry is Polygon alreadyPolygon)
        {
            logMessage = $"  {label}: already a single Polygon, nothing to reduce.";
            return alreadyPolygon;
        }

        var unioned = geometry.Union();
        if (unioned is Polygon unionedPolygon)
        {
            logMessage = $"  {label}: Union() collapsed all parts into one simply-connected Polygon.";
            return unionedPolygon;
        }

        if (unioned is not MultiPolygon multi || multi.NumGeometries == 0)
            throw new InvalidOperationException(
                $"{label}: unexpected geometry type {unioned.GeometryType} after union.");

        var referencePoint = new Point(referenceLng, referenceLat);
        Polygon? chosen = null;
        var discardedArea = 0.0;
        var totalArea = 0.0;
        for (var i = 0; i < multi.NumGeometries; i++)
        {
            var part = (Polygon)multi.GetGeometryN(i);
            totalArea += part.Area;
            if (part.Contains(referencePoint))
                chosen = part;
            else
                discardedArea += part.Area;
        }

        if (chosen == null)
            throw new InvalidOperationException(
                $"{label}: reference point ({referenceLng}, {referenceLat}) is not inside any of the " +
                $"{multi.NumGeometries} disjoint parts after union — update the reference point to a " +
                $"location known to be inside the mainland part before re-running.");

        logMessage =
            $"  {label}: {multi.NumGeometries} disjoint parts after union — keeping the one " +
            $"containing the reference point (area {chosen.Area:F6} deg² of {totalArea:F6} deg² total), " +
            $"discarding {multi.NumGeometries - 1} other part(s) (discarded area {discardedArea:F6} deg²).";

        return chosen;
    }
}

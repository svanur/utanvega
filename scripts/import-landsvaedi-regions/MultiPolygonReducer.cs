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
//
// Two extra robustness fixes, added by #1751 when scripts/import-municipality-boundaries reused
// this type for 7 more municipalities (Seltjarnarnesbær..Sveitarfélagið Stykkishólmur) — neither
// was needed by IS8/IS6 or the original 4 municipalities, but both are cheap no-ops when the
// input doesn't need them, so they're folded into every return path here rather than kept as a
// second, divergent copy in the municipality script:
//   4. Hveragerðisbær: Union() can collapse touching parts into a Polygon whose ring touches
//      itself at a single point — OGC counts that as valid (IsValid=true) but not simple
//      (IsSimple=false). CleanSelfTouching Buffer(0)-fixes this without changing covered area.
//   5. Sveitarfélagið Stykkishólmur (324 disjoint parts): a raw MultiPolygon with an internally
//      self-intersecting part can make Union()'s noded overlay throw TopologyException outright
//      instead of returning a result. Caught as a fallback only — re-unions a Buffer(0)-cleaned
//      copy of the raw geometry — so geometry that unions cleanly on the first try is untouched.

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
            return CleanSelfTouching(alreadyPolygon, label, ref logMessage);
        }

        Geometry unioned;
        try
        {
            unioned = geometry.Union();
        }
        catch (TopologyException)
        {
            unioned = geometry.Buffer(0).Union();
        }

        if (unioned is Polygon unionedPolygon)
        {
            logMessage = $"  {label}: Union() collapsed all parts into one simply-connected Polygon.";
            return CleanSelfTouching(unionedPolygon, label, ref logMessage);
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

        return CleanSelfTouching(chosen, label, ref logMessage);
    }

    // Buffer(0) is NTS's standard fix for a Polygon whose ring touches itself at a single point
    // (IsValid=true per OGC's relaxed self-tangency rule, but IsSimple=false) — a zero-distance
    // buffer forces a clean, non-self-touching ring without changing the covered area. A no-op
    // (same instance back, logMessage untouched) when the Polygon is already simple and valid.
    private static Polygon CleanSelfTouching(Polygon polygon, string label, ref string logMessage)
    {
        if (polygon.IsSimple && polygon.IsValid)
            return polygon;

        if (polygon.Buffer(0) is not Polygon cleaned)
            throw new InvalidOperationException(
                $"{label}: Buffer(0) clean-up of a self-touching Polygon did not produce a Polygon.");

        logMessage += " (self-touching ring cleaned up via Buffer(0).)";
        return cleaned;
    }
}

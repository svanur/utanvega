// #1705: one-time import of real municipality boundaries for the 4 Greater Reykjavík
// municipalities (Reykjavík, Kópavogur, Hafnarfjörður, Garðabær), from Landmælingar Íslands'
// IS 50V WFS, into Location.Boundary via the existing admin API. This is a standalone console
// tool, not part of the backend web app's build or runtime — it is run manually, once per
// municipality (or again if a municipality's upstream boundary data changes).
//
// ── The exact WFS request (confirmed live against the service, 2026-11-08) ──
//
//   GET https://gis.lmi.is/geoserver/wfs
//       ?service=WFS&version=2.0.0&request=GetFeature
//       &typeName=IS_50V:mork_sveitarf_svaedi
//       &outputFormat=application/json
//       &srsName=EPSG:4326
//       &CQL_FILTER=sveitarfelag=%27<municipality-name-url-encoded>%27
//
// Confirmed via the service's own GetCapabilities/DescribeFeatureType:
//   - IS_50V:mork_sveitarf_svaedi is a real layer on this server (GetCapabilities lists it
//     alongside IS_50V:mork_sveitarf_flakar and IS_50V:v_mork_sveitarf_svaedi).
//   - Its feature type has a string field "sveitarfelag" (the official municipality name, e.g.
//     "Reykjavíkurborg", not "Reykjavík") and an int field "nrsveitarfelags" (the official
//     municipality code) — CQL_FILTER above matches on "sveitarfelag".
//   - srsName=EPSG:4326 is honoured: every returned feature's geometry is WGS84 as requested,
//     no reprojection needed on our side.
//
// ── Why this tool unions the raw geometry before calling the admin API ──
//
// Every one of the 4 municipalities comes back as a GeoJSON MultiPolygon, not a Polygon — IS 50V
// models a municipality's land as a set of separate "svæði" (areas): a mainland body plus any
// number of small offshore islands/skerries it administers. Location.Boundary's validator
// (LocationBoundaryParser, backend/Application/Locations/LocationBoundaryParser.cs) only accepts
// a Polygon, by design (#1705 scope) — a MultiPolygon is rejected outright, not silently
// flattened by the backend. So this tool does the MultiPolygon → Polygon reduction once, up
// front, documented here instead of inside the application:
//
//   1. Try NetTopologySuite's geometry Union() across all parts. When the parts touch or overlap
//      (shared edge/vertex), the union collapses to a single simply-connected Polygon and that
//      exact result is sent as BoundaryGeoJson — no data is dropped.
//   2. When the union is still a MultiPolygon (the parts are genuinely disjoint), this tool keeps
//      the part that Contains() the municipality's known town-centre reference point (see
//      Municipality.ReferenceLng/Lat below) and discards the rest, logging what got dropped.
//      IMPORTANT: "largest area" was tried first and rejected — verified live against this WFS
//      service on 2026-11-08, for both Reykjavík and Kópavogur the single largest-area disjoint
//      part is NOT the one containing the actual town/trail-dense area (Reykjavík's largest part
//      is the sparser Kjalarnes/eastern exurb land; Kópavogur's largest part is its southern
//      highland extension toward Bláfjöll) — so "pick the biggest polygon" would have silently
//      produced a Boundary that excludes the municipality's own downtown. Picking by
//      "contains the known centre point" instead is deliberate and gets this right for all 4;
//      it is still a documented simplification (e.g. Esjan's hiking trails sit in a Reykjavík
//      exclave north of Kjalarnes that this reduction excludes) — not a bug, and logged per
//      municipality (part count + area kept vs. discarded) so it's visible at import time.
//
// ── Usage ──
//
//   cd scripts/import-municipality-boundaries
//   dotnet run -- --dry-run
//       Fetches every municipality in the array below, unions/reduces each to a Polygon, prints
//       the resulting BoundaryGeoJson and area-kept-vs-discarded log — makes no admin API calls.
//       Use this to eyeball the result (e.g. paste a printed BoundaryGeoJson into geojson.io)
//       before writing anything.
//
//   UTANVEGA_ADMIN_API_URL=https://api.hlaupadagskra.is UTANVEGA_ADMIN_TOKEN=<jwt> \
//       dotnet run -- --apply
//       Same fetch/reduce, then PUTs <UTANVEGA_ADMIN_API_URL>/api/v1/admin/locations/{id} with
//       BoundaryGeoJson set to the reduced Polygon (and every other field echoed back unchanged)
//       — the existing admin-only UpdateLocationCommand endpoint, no new backend endpoint. Each
//       municipality in the array must already exist as a Location (by slug) before this is run;
//       it only attaches a boundary, it does not create the Location. Requires an AdminOnly-
//       policy bearer token in UTANVEGA_ADMIN_TOKEN.
//
// Re-run this same recipe (just change Municipalities below) for any future municipality.

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

var apply = args.Contains("--apply");

const string WfsBaseUrl = "https://gis.lmi.is/geoserver/wfs";
const string TypeName = "IS_50V:mork_sveitarf_svaedi";

// The 4 Greater Reykjavík municipalities locked by #1700/#1705, plus 7 more added by #1751 —
// add future municipalities here, matching (WFS "sveitarfelag" value, our Location slug,
// approximate town-centre lng/lat used only to pick the right disjoint part after Union(), per
// the file header comment above). The 7 added by #1751 keep their existing display Name as-is —
// this tool only ever echoes name/nameEn back unchanged (see ApplyAsync below), it never renames.
var municipalities = new[]
{
    new Municipality("Reykjavíkurborg", "reykjavik", -21.9426, 64.1466),
    new Municipality("Kópavogsbær", "kopavogur", -21.9093, 64.1058),
    new Municipality("Hafnarfjarðarkaupstaður", "hafnarfjordur", -21.9403, 64.0671),
    new Municipality("Garðabær", "gardabaer", -21.9291, 64.0896),
    new Municipality("Seltjarnarnesbær", "seljtjarnarnes", -22.0026, 64.1542),
    new Municipality("Mosfellsbær", "mosfellsbaer", -21.6861, 64.1655),
    new Municipality("Reykjanesbær", "reykjanesbaer", -22.5937, 63.9208),
    new Municipality("Hveragerðisbær", "hveragerdi", -21.1858, 64.0005),
    new Municipality("Akureyrarbær", "akureyri", -18.1105, 65.6826),
    new Municipality("Vestmannaeyjabær", "vestmannaeyjar", -20.2755, 63.4427),
    new Municipality("Sveitarfélagið Stykkishólmur", "stykkisholmur", -22.7266, 65.0760),
};

using var http = new HttpClient();
using var wfsHttp = new HttpClient();
var geoJsonReader = new GeoJsonReader();
var geoJsonWriter = new GeoJsonWriter();

var adminApiUrl = Environment.GetEnvironmentVariable("UTANVEGA_ADMIN_API_URL");
var adminToken = Environment.GetEnvironmentVariable("UTANVEGA_ADMIN_TOKEN");
if (apply)
{
    if (string.IsNullOrEmpty(adminApiUrl) || string.IsNullOrEmpty(adminToken))
    {
        Console.Error.WriteLine("--apply requires UTANVEGA_ADMIN_API_URL and UTANVEGA_ADMIN_TOKEN.");
        return 1;
    }
    http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
}

foreach (var muni in municipalities)
{
    var requestUrl =
        $"{WfsBaseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeName={Uri.EscapeDataString(TypeName)}" +
        $"&outputFormat=application/json&srsName=EPSG:4326&CQL_FILTER=sveitarfelag=%27{Uri.EscapeDataString(muni.WfsName)}%27";

    Console.WriteLine($"── {muni.WfsName} ({muni.Slug}) ──");
    Console.WriteLine($"GET {requestUrl}");

    var json = await wfsHttp.GetStringAsync(requestUrl);
    var featureCollection = JsonDocument.Parse(json);
    var features = featureCollection.RootElement.GetProperty("features");
    if (features.GetArrayLength() != 1)
    {
        Console.Error.WriteLine($"  Expected exactly 1 feature, got {features.GetArrayLength()} — skipping.");
        continue;
    }

    var geometryJson = features[0].GetProperty("geometry").GetRawText();
    var rawGeometry = geoJsonReader.Read<Geometry>(geometryJson);

    var polygon = ReduceToSinglePolygon(rawGeometry, muni.WfsName, muni.ReferenceLng, muni.ReferenceLat);
    polygon.SRID = 4326;

    // Same rule LocationBoundaryParser enforces server-side — fail loudly here rather than have
    // the admin API's validator reject it later with a less specific error.
    if (!polygon.IsSimple || !polygon.IsValid)
        throw new InvalidOperationException($"{muni.WfsName}: reduced polygon is not simple/valid.");

    var boundaryGeoJson = geoJsonWriter.Write(polygon);
    Console.WriteLine($"  Reduced to Polygon: {polygon.NumPoints} vertices, area {polygon.Area:F6} deg².");

    if (!apply)
    {
        Console.WriteLine($"  BoundaryGeoJson: {boundaryGeoJson}");
        continue;
    }

    await ApplyAsync(http, adminApiUrl!, muni.Slug, boundaryGeoJson);
}

return 0;

// Union() collapses touching/overlapping parts into one simply-connected Polygon. If what's left
// is still a MultiPolygon (genuinely disjoint parts — the common case for this layer, see the
// file header comment on why this picks "contains the reference point" over "largest area").
static Polygon ReduceToSinglePolygon(Geometry geometry, string label, double referenceLng, double referenceLat)
{
    if (geometry is Polygon alreadyPolygon)
        return CleanSelfTouching(alreadyPolygon, label);

    Geometry unioned;
    try
    {
        unioned = geometry.Union();
    }
    catch (TopologyException)
    {
        // Seen live for Sveitarfélagið Stykkishólmur (#1751): its raw MultiPolygon has a part
        // with a self-intersecting ring, which made Union()'s noded overlay throw ("side location
        // conflict") instead of returning a result — a robustness limit of the overlay algorithm
        // on invalid input, not something the other 10 municipalities hit (their Union() succeeds
        // on the first try above). Buffer(0)-cleaning the raw geometry first and re-unioning is
        // NTS's standard escape hatch for this; only used as a fallback here, not applied
        // up front, so it cannot change the already-working result for the other 10.
        unioned = geometry.Buffer(0).Union();
    }
    if (unioned is Polygon unionedPolygon)
        return CleanSelfTouching(unionedPolygon, label);

    if (unioned is not MultiPolygon multi || multi.NumGeometries == 0)
        throw new InvalidOperationException($"{label}: unexpected geometry type {unioned.GeometryType} after union.");

    var referencePoint = new Point(referenceLng, referenceLat);
    Polygon? chosen = null;
    var discardedArea = 0.0;
    var totalArea = 0.0;
    for (int i = 0; i < multi.NumGeometries; i++)
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
            $"{multi.NumGeometries} disjoint parts after union — update its ReferenceLng/ReferenceLat " +
            $"to a point known to be inside the municipality before re-running.");

    Console.WriteLine(
        $"  {label}: {multi.NumGeometries} disjoint parts after union — keeping the one " +
        $"containing the reference point (area {chosen.Area:F6} deg² of {totalArea:F6} deg² total), " +
        $"discarding {multi.NumGeometries - 1} other part(s) (discarded area {discardedArea:F6} deg², " +
        $"offshore islands/skerries and/or exclaves — observed for the original 4 Greater Reykjavík " +
        $"municipalities (#1705, 2026-11-08) and the 7 added by #1751).");

    return CleanSelfTouching(chosen, label);
}

// Seen live for Hveragerðisbær (#1751): Union() collapsed its MultiPolygon into a single Polygon
// whose ring touches itself at one point — OGC counts that as valid (IsValid=true) but not simple
// (IsSimple=false), and LocationBoundaryParser (and the main loop's own check, mirroring it)
// requires both. Buffer(0) is NTS's standard fix for this: a zero-distance buffer forces a clean,
// non-self-touching ring without changing the covered area.
static Polygon CleanSelfTouching(Polygon polygon, string label)
{
    if (polygon.IsSimple && polygon.IsValid)
        return polygon;

    if (polygon.Buffer(0) is Polygon cleaned)
        return cleaned;

    throw new InvalidOperationException($"{label}: Buffer(0) clean-up of a self-touching Polygon did not produce a Polygon.");
}

static async Task ApplyAsync(HttpClient http, string adminApiUrl, string slug, string boundaryGeoJson)
{
    // GetLocationsQuery (via GET /api/v1/admin/locations) — same admin-only endpoint/DTO the
    // admin dashboard's location list uses — gives us the existing Id and every field
    // UpdateLocationCommand needs to echo back unchanged alongside the new BoundaryGeoJson.
    var all = await http.GetFromJsonAsync<JsonElement>($"{adminApiUrl}/api/v1/admin/locations");
    var match = all.EnumerateArray().FirstOrDefault(l => l.GetProperty("slug").GetString() == slug);

    if (match.ValueKind != JsonValueKind.Object)
    {
        Console.Error.WriteLine(
            $"  No existing Location with slug '{slug}' — this tool only updates an existing " +
            $"Location's boundary. Create the Location first (name/type/parent) via the admin " +
            $"UI, then re-run this tool to attach its boundary.");
        return;
    }

    var id = match.GetProperty("id").GetString();
    var body = new
    {
        id,
        name = match.GetProperty("name").GetString(),
        nameEn = match.GetProperty("nameEn").GetString(),
        slug,
        description = match.GetProperty("description").GetString(),
        descriptionEn = match.GetProperty("descriptionEn").GetString(),
        type = match.GetProperty("type").GetString(),
        parentId = match.GetProperty("parentId").ValueKind == JsonValueKind.Null ? null : match.GetProperty("parentId").GetString(),
        latitude = match.GetProperty("latitude").ValueKind == JsonValueKind.Null ? (double?)null : match.GetProperty("latitude").GetDouble(),
        longitude = match.GetProperty("longitude").ValueKind == JsonValueKind.Null ? (double?)null : match.GetProperty("longitude").GetDouble(),
        radius = match.GetProperty("radius").ValueKind == JsonValueKind.Null ? (double?)null : match.GetProperty("radius").GetDouble(),
        updatedBy = "import-municipality-boundaries-script",
        boundaryGeoJson,
    };
    var response = await http.PutAsJsonAsync($"{adminApiUrl}/api/v1/admin/locations/{id}", body);
    Console.WriteLine($"  PUT /api/v1/admin/locations/{id} -> {(int)response.StatusCode}");
}

record Municipality(string WfsName, string Slug, double ReferenceLng, double ReferenceLat);

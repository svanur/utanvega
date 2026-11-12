// #1764: one-time replacement of the 5 informal regions (Norðurland, Austurland, Suðurland,
// Vesturland, Reykjanes) with Statistics Iceland (Hagstofa Íslands)'s 8 official "landsvæði"
// boundaries, into Location.Boundary via the existing admin API. Standalone console tool, not
// part of the backend web app's build or runtime — run manually, once.
//
// ── The data file ──
//
// landsvaedi-is.json (committed alongside this Program.cs) is an 8-feature GeoJSON
// FeatureCollection, EPSG:4326, properties {source, id: "ISn", name}. It was downloaded once from
// a GitHub issue-comment attachment (not a stable, re-fetchable API like the municipality
// script's IS 50V WFS endpoint — a one-off attachment URL isn't safe to depend on resolving the
// same way again next year) and is read from disk here, never fetched live:
//
// Attribution (required — the file's own "source" property points here): boundary data ©
// simplemaps.com (https://simplemaps.com/gis/country/is#admin1), licensed CC BY 4.0
// (https://creativecommons.org/licenses/by/4.0/). Not Hagstofa Íslands/LMÍ-sourced, despite the
// "landsvæði" naming — it's a third-party admin1 boundary set that happens to split the country
// the same way Hagstofa's statistical regions do.
//
//   IS1 Höfuðborgarsvæði   Polygon       → Höfuðborgarsvæðið (boundary only, name unchanged)
//   IS2 Suðurnes           Polygon       → Reykjanes, renamed to Suðurnes/sudurnes
//   IS3 Vesturland         Polygon       → Vesturland (boundary only)
//   IS4 Vestfirðir         Polygon       → Vestfirðir (boundary only)
//   IS5 Norðurland vestra  Polygon       → NEW Region, child of Ísland
//   IS6 Norðurland eystra  MultiPolygon  → NEW Region, child of Ísland (mainland part only)
//   IS7 Austurland         Polygon       → Austurland (boundary only)
//   IS8 Suðurland          MultiPolygon  → Suðurland (boundary only, mainland part only)
//
// IS6 and IS8's MultiPolygon → Polygon reduction (mainland part only, offshore islands discarded)
// reuses the exact algorithm scripts/import-municipality-boundaries/Program.cs already documents
// for the 4 Greater Reykjavík municipalities — "largest area" was rejected as the selection rule
// by that precedent (its largest-area disjoint part wasn't reliably the populated mainland one),
// "contains a known mainland reference point" is deliberate and carried over here. See
// MultiPolygonReducer.cs for the extracted, unit-tested implementation.
//
//   IS8 Suðurland: 3 disjoint parts after Union() — mainland (kept, contains the Selfoss
//   reference point), plus Vestmannaeyjar (Heimaey, bbox ~[-20.31,63.40]–[-20.25,63.45]) and one
//   unidentified sliver further east (bbox ~[-17.82,63.68]–[-17.74,63.72]), both discarded.
//
//   IS6 Norðurland eystra: 3 disjoint parts after Union() — mainland (kept, contains the
//   Akureyri reference point), plus Grímsey (bbox ~[-18.02,66.53]–[-17.98,66.56]) and Hrísey
//   (bbox ~[-18.41,65.98]–[-18.36,66.03]), both discarded.
//
// ── Why this tool always reads the current Location tree, even in --dry-run ──
//
// Unlike the municipality script (whose --dry-run needed zero admin API calls — WFS fetch + local
// reduction only), this script's job is inherently about *moving* existing child Locations and
// TrailLocation links out of old Norðurland and into whichever of the two new regions actually
// contains them, plus a spot-check of the 6 boundary-swapped-only regions against their new
// polygons. Both need the live Location/Trail tree to compute a meaningful plan, so both
// --dry-run and --apply require UTANVEGA_ADMIN_API_URL/UTANVEGA_ADMIN_TOKEN and both make GET
// calls; only --apply makes the mutating PUT/POST/DELETE calls (dry-run prints "[dry-run] would
// ..." instead and makes no mutating calls).
//
// ── The "point" used for point-in-polygon checks ──
//
// A Location being reassigned/spot-checked is tested at its stored Center (Latitude/Longitude,
// already exposed by GET /api/v1/admin/locations). A Trail being reassigned/spot-checked has no
// single exposed "location" of its own — the admin trails list (GetTrailsQuery/TrailDto) exposes
// only its GPX route's start coordinate, not the full route geometry, and adding a new endpoint
// to expose more is out of scope (#1764 explicitly reuses the existing admin API, no new backend
// endpoint). So a trail's start coordinate is used as its representative point — a documented
// simplification, logged per trail, in the same spirit as the municipality script's documented
// Esjan/Kjalarnes exclusion. A trail with no GPX data (no start coordinate) can't be tested this
// way at all; it is logged and left untouched for manual follow-up rather than guessed.
//
// ── Usage ──
//
//   cd scripts/import-landsvaedi-regions
//   UTANVEGA_ADMIN_API_URL=http://localhost:5062 UTANVEGA_ADMIN_TOKEN=<jwt> dotnet run -- --dry-run
//       Reads landsvaedi-is.json, reduces IS6/IS8, fetches the current Location/Trail tree, and
//       prints the full plan (every boundary that would be set, every child/trail that would
//       move and why, every spot-check mismatch found and its proposed correction) — makes no
//       mutating admin API calls.
//
//   UTANVEGA_ADMIN_API_URL=https://api.hlaupadagskra.is UTANVEGA_ADMIN_TOKEN=<jwt> \
//       dotnet run -- --apply
//       Same plan, then actually PUTs/POSTs/DELETEs it via the existing admin-only
//       Create/UpdateLocationCommand endpoints and the trail-location inline-management
//       endpoints — no new backend endpoint. Requires an AdminOnly-policy bearer token.

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Utanvega.Scripts.ImportLandsvaediRegions;

var apply = args.Contains("--apply");

// Location ids for which an apply-mode PUT returned a non-success status — accumulated across all
// 3 call sites and reported in the final summary (see PutLocationAsync below).
var failedPutLocationIds = new List<Guid>();

// Known-mainland reference points for the two MultiPolygon reductions (see file header above).
const double SelfossLng = -20.9929, SelfossLat = 63.9333;
const double AkureyriLng = -18.1104, AkureyriLat = 65.6885;

// Existing region Names as of #1764 — matched exactly against the live Location tree. These are
// the Icelandic region names #1764's own issue text uses throughout; if the live DB has slightly
// different spelling, this tool fails loudly below (lists every top-level Location it did find)
// rather than silently matching the wrong row.
const string Hofudborgarsvaedid = "Höfuðborgarsvæðið";
const string Vesturland = "Vesturland";
const string Vestfirdir = "Vestfirðir";
const string Austurland = "Austurland";
const string Sudurland = "Suðurland";
const string Reykjanes = "Reykjanes"; // renamed to Suðurnes below
const string Sudurnes = "Suðurnes";
const string NordurlandOld = "Norðurland";
const string NordurlandVestra = "Norðurland vestra";
const string NordurlandEystra = "Norðurland eystra";
const string Island = "Ísland";

var adminApiUrl = Environment.GetEnvironmentVariable("UTANVEGA_ADMIN_API_URL");
var adminToken = Environment.GetEnvironmentVariable("UTANVEGA_ADMIN_TOKEN");
if (string.IsNullOrEmpty(adminApiUrl) || string.IsNullOrEmpty(adminToken))
{
    Console.Error.WriteLine(
        "UTANVEGA_ADMIN_API_URL and UTANVEGA_ADMIN_TOKEN are required for both --dry-run and " +
        "--apply — this script needs to read the live Location/Trail tree to compute its plan.");
    return 1;
}

using var http = new HttpClient();
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
var geoJsonReader = new GeoJsonReader();
var geoJsonWriter = new GeoJsonWriter();

// ── 1. Load and parse the committed data file ──

var dataFilePath = Path.Combine(AppContext.BaseDirectory, "landsvaedi-is.json");
if (!File.Exists(dataFilePath))
{
    Console.Error.WriteLine($"Data file not found: {dataFilePath}");
    return 1;
}

var featuresByIsCode = new Dictionary<string, (string Name, Geometry Geometry)>();
using (var doc = JsonDocument.Parse(await File.ReadAllTextAsync(dataFilePath)))
{
    foreach (var feature in doc.RootElement.GetProperty("features").EnumerateArray())
    {
        var props = feature.GetProperty("properties");
        var isCode = props.GetProperty("id").GetString()!;
        var name = props.GetProperty("name").GetString()!;
        var geometry = geoJsonReader.Read<Geometry>(feature.GetProperty("geometry").GetRawText());
        featuresByIsCode[isCode] = (name, geometry);
    }
}

Console.WriteLine($"Loaded {featuresByIsCode.Count} landsvæði features from {dataFilePath}.");

// ── 2. Reduce the two MultiPolygon features up front, validate every polygon ──

var finalPolygons = new Dictionary<string, Polygon>(); // region name → final Polygon to apply

ValidateAndStore(Hofudborgarsvaedid, AsPolygon(featuresByIsCode["IS1"].Geometry, "IS1 Höfuðborgarsvæði"));
ValidateAndStore(Vesturland, AsPolygon(featuresByIsCode["IS3"].Geometry, "IS3 Vesturland"));
ValidateAndStore(Vestfirdir, AsPolygon(featuresByIsCode["IS4"].Geometry, "IS4 Vestfirðir"));
ValidateAndStore(Austurland, AsPolygon(featuresByIsCode["IS7"].Geometry, "IS7 Austurland"));
ValidateAndStore(Sudurnes, AsPolygon(featuresByIsCode["IS2"].Geometry, "IS2 Suðurnes"));
ValidateAndStore(NordurlandVestra, AsPolygon(featuresByIsCode["IS5"].Geometry, "IS5 Norðurland vestra"));

var sudurlandPolygon = MultiPolygonReducer.ReduceToMainlandPolygon(
    featuresByIsCode["IS8"].Geometry, "Suðurland (IS8)", SelfossLng, SelfossLat, out var sudurlandLog);
Console.WriteLine(sudurlandLog);
ValidateAndStore(Sudurland, sudurlandPolygon);

var nordurlandEystraPolygon = MultiPolygonReducer.ReduceToMainlandPolygon(
    featuresByIsCode["IS6"].Geometry, "Norðurland eystra (IS6)", AkureyriLng, AkureyriLat, out var nordurlandEystraLog);
Console.WriteLine(nordurlandEystraLog);
ValidateAndStore(NordurlandEystra, nordurlandEystraPolygon);

// ── 3. Fetch the current Location/Trail tree (read-only, needed by both --dry-run and --apply) ──

var allLocations = await FetchAllLocationsAsync();
var allTrails = await FetchAllTrailsAsync();

var boundarySwapOnlyRegions = new[] { Hofudborgarsvaedid, Vesturland, Vestfirdir, Austurland, Sudurland };

Guid RequireLocationId(string name)
{
    var match = allLocations.EnumerateArray().FirstOrDefault(l => l.GetProperty("name").GetString() == name);
    if (match.ValueKind != JsonValueKind.Object)
    {
        var found = string.Join(", ", allLocations.EnumerateArray()
            .Where(l => l.GetProperty("parentId").ValueKind == JsonValueKind.Null)
            .Select(l => l.GetProperty("name").GetString()));
        throw new InvalidOperationException(
            $"No Location named '{name}' found. Top-level Locations in the DB: {found}");
    }
    return Guid.Parse(match.GetProperty("id").GetString()!);
}

var islandId = RequireLocationId(Island);
var reykjanesId = RequireLocationId(Reykjanes);
var nordurlandOldId = RequireLocationId(NordurlandOld);
var boundarySwapIds = boundarySwapOnlyRegions.ToDictionary(name => name, RequireLocationId);

// ── 4. The 4 plain boundary swaps (Höfuðborgarsvæðið, Vesturland, Vestfirðir, Austurland) ──

foreach (var name in new[] { Hofudborgarsvaedid, Vesturland, Vestfirdir, Austurland })
{
    await UpdateBoundaryOnlyAsync(name, boundarySwapIds[name]);
}

// ── 5. Suðurland — boundary swap only, mainland-reduced polygon from step 2 ──

await UpdateBoundaryOnlyAsync(Sudurland, boundarySwapIds[Sudurland]);

// ── 6. Reykjanes → Suðurnes: Name/NameEn/Slug rename + IS2 boundary, ParentId/children untouched ──

Console.WriteLine($"── {Reykjanes} → {Sudurnes} (IS2) ──");
var reykjanesMatch = allLocations.EnumerateArray().First(l => Guid.Parse(l.GetProperty("id").GetString()!) == reykjanesId);
var sudurnesBody = BuildUpdateBody(reykjanesMatch,
    boundaryGeoJson: geoJsonWriter.Write(finalPolygons[Sudurnes]),
    overrideName: Sudurnes, overrideNameEn: Sudurnes, overrideSlug: "sudurnes");
await PutLocationAsync(reykjanesId, sudurnesBody);

// ── 7. Create the two new regions as children of Ísland ──

Guid? nordurlandVestraId = null;
Guid? nordurlandEystraId = null;

Console.WriteLine($"── Create {NordurlandVestra} (IS5) ──");
nordurlandVestraId = await CreateRegionAsync(NordurlandVestra, finalPolygons[NordurlandVestra], islandId);

Console.WriteLine($"── Create {NordurlandEystra} (IS6, mainland only) ──");
nordurlandEystraId = await CreateRegionAsync(NordurlandEystra, finalPolygons[NordurlandEystra], islandId);

// ── 8. Split old Norðurland: reassign every child Location and every direct TrailLocation link ──

Console.WriteLine($"── Split old {NordurlandOld} into {NordurlandVestra} / {NordurlandEystra} ──");

string? DetermineNordurlandBucket(double? lat, double? lng)
{
    if (lat is null || lng is null) return null;
    var point = new Point(lng.Value, lat.Value) { SRID = 4326 };
    if (finalPolygons[NordurlandVestra].Contains(point)) return NordurlandVestra;
    if (finalPolygons[NordurlandEystra].Contains(point)) return NordurlandEystra;
    return null;
}

var unresolvedCount = 0;

// 8a. Children of old Norðurland
var oldNordurlandChildren = allLocations.EnumerateArray()
    .Where(l => l.GetProperty("parentId").ValueKind != JsonValueKind.Null &&
                Guid.Parse(l.GetProperty("parentId").GetString()!) == nordurlandOldId)
    .ToList();

foreach (var child in oldNordurlandChildren)
{
    var name = child.GetProperty("name").GetString();
    var lat = GetNullableDouble(child, "latitude");
    var lng = GetNullableDouble(child, "longitude");
    var bucket = DetermineNordurlandBucket(lat, lng);
    if (bucket == null)
    {
        Console.WriteLine($"  UNRESOLVED: child Location '{name}' ({lat},{lng}) is not inside either new polygon — needs manual reassignment.");
        unresolvedCount++;
        continue;
    }

    Console.WriteLine($"  child Location '{name}' → {bucket}");
    if (!apply) continue;

    var newParentId = bucket == NordurlandVestra ? nordurlandVestraId!.Value : nordurlandEystraId!.Value;
    var body = BuildUpdateBody(child, overrideParentId: newParentId);
    await PutLocationAsync(Guid.Parse(child.GetProperty("id").GetString()!), body);
}

// 8b. Direct TrailLocation links to old Norðurland
var oldNordurlandTrailLinks = allTrails.EnumerateArray()
    .SelectMany(t => t.GetProperty("locations").EnumerateArray()
        .Where(l => Guid.Parse(l.GetProperty("id").GetString()!) == nordurlandOldId)
        .Select(l => (Trail: t, Link: l)))
    .ToList();

foreach (var (trail, link) in oldNordurlandTrailLinks)
{
    var trailId = Guid.Parse(trail.GetProperty("id").GetString()!);
    var trailName = trail.GetProperty("name").GetString();
    var role = link.GetProperty("role").GetString()!;
    var lat = GetNullableDouble(trail, "startLatitude");
    var lng = GetNullableDouble(trail, "startLongitude");
    var bucket = DetermineNordurlandBucket(lat, lng);
    if (bucket == null)
    {
        Console.WriteLine($"  UNRESOLVED: trail '{trailName}' ({lat},{lng}) start point is not inside either new polygon, or has no GPX start point — needs manual reassignment.");
        unresolvedCount++;
        continue;
    }

    Console.WriteLine($"  trail '{trailName}' direct link → {bucket} (role {role})");
    if (!apply) continue;

    var newLocationId = bucket == NordurlandVestra ? nordurlandVestraId!.Value : nordurlandEystraId!.Value;
    var linked = await PostTrailLocationAsync(trailId, newLocationId, role);
    if (!linked)
    {
        Console.WriteLine($"  UNRESOLVED: trail '{trailName}' link to {bucket} failed to create — leaving the old {NordurlandOld} link in place, not deleting it.");
        unresolvedCount++;
        continue;
    }
    await DeleteTrailLocationAsync(trailId, nordurlandOldId);
}

// 8c. Delete old Norðurland once it's confirmed empty
if (apply)
{
    if (unresolvedCount > 0)
    {
        Console.WriteLine($"  Skipping delete of old {NordurlandOld}: {unresolvedCount} unresolved child/trail link(s) above — fix manually, then re-run or delete by hand.");
    }
    else
    {
        var refreshed = await FetchAllLocationsAsync();
        var oldRow = refreshed.EnumerateArray().First(l => Guid.Parse(l.GetProperty("id").GetString()!) == nordurlandOldId);
        var childrenCount = oldRow.GetProperty("childrenCount").GetInt32();
        var trailsCount = oldRow.GetProperty("trailsCount").GetInt32();
        if (childrenCount == 0 && trailsCount == 0)
        {
            var response = await http.DeleteAsync($"{adminApiUrl}/api/v1/admin/locations/{nordurlandOldId}");
            Console.WriteLine($"  DELETE /api/v1/admin/locations/{nordurlandOldId} -> {(int)response.StatusCode}");
        }
        else
        {
            Console.WriteLine($"  Skipping delete of old {NordurlandOld}: still has {childrenCount} children / {trailsCount} trail links after reassignment — manual follow-up needed.");
        }
    }
}
else
{
    Console.WriteLine($"  [dry-run] would delete old {NordurlandOld} once every child/trail link above is reassigned.");
}

// ── 9. Spot-check: every child Location and direct TrailLocation link under the 6 ──
//      boundary-swapped-only regions (Höfuðborgarsvæðið, Vesturland, Vestfirðir, Austurland,
//      Suðurland, Suðurnes) must still fall inside that region's NEW polygon. Checked against the
//      pre-mutation snapshot (allLocations/allTrails above) — this script doesn't change which
//      Locations/trails are linked to these 6 regions, only their boundary, so that snapshot is
//      still the correct membership list; only the polygon being tested against is new.

Console.WriteLine("── Spot-check: 6 boundary-swapped regions against their new polygons ──");

var allFinalRegionIds = new Dictionary<string, Guid>(boundarySwapIds) { [Sudurnes] = reykjanesId };
// The 2 new regions only have a real Id once --apply actually created them; in --dry-run there's
// nothing yet to spot-check them against (they don't own any children/trails pre-mutation), so
// they're intentionally left out of allFinalRegionIds here — the spot-check below is scoped to
// the 6 regions named in #1764's acceptance criteria, not the 2 new ones.
if (apply && nordurlandVestraId.HasValue) allFinalRegionIds[NordurlandVestra] = nordurlandVestraId.Value;
if (apply && nordurlandEystraId.HasValue) allFinalRegionIds[NordurlandEystra] = nordurlandEystraId.Value;

string? DetermineAnyRegion(double? lat, double? lng)
{
    if (lat is null || lng is null) return null;
    var point = new Point(lng.Value, lat.Value) { SRID = 4326 };
    foreach (var (name, polygon) in finalPolygons)
        if (polygon.Contains(point))
            return name;
    return null;
}

foreach (var regionName in boundarySwapOnlyRegions.Append(Sudurnes))
{
    var regionId = allFinalRegionIds[regionName];
    var polygon = finalPolygons[regionName];

    var children = allLocations.EnumerateArray()
        .Where(l => l.GetProperty("parentId").ValueKind != JsonValueKind.Null &&
                    Guid.Parse(l.GetProperty("parentId").GetString()!) == regionId)
        .ToList();

    foreach (var child in children)
    {
        var lat = GetNullableDouble(child, "latitude");
        var lng = GetNullableDouble(child, "longitude");
        if (lat is null || lng is null) continue; // nothing to test
        var point = new Point(lng.Value, lat.Value) { SRID = 4326 };
        if (polygon.Contains(point)) continue;

        var name = child.GetProperty("name").GetString();
        var actual = DetermineAnyRegion(lat, lng);
        if (actual == null)
        {
            Console.WriteLine($"  MISMATCH: child Location '{name}' under {regionName} is outside {regionName}'s new polygon and outside every other region's polygon too — UNRESOLVED, manual fix needed.");
            continue;
        }

        Console.WriteLine($"  MISMATCH: child Location '{name}' under {regionName} is actually inside {actual} — reassigning.");
        if (!apply) continue;
        var newParentId = allFinalRegionIds.TryGetValue(actual, out var id) ? id : (Guid?)null;
        if (newParentId == null)
        {
            Console.WriteLine($"    Skipped: {actual}'s Id isn't known yet in this run (only resolved on --apply after it's created) — re-run this tool once more after this pass completes.");
            continue;
        }
        var body = BuildUpdateBody(child, overrideParentId: newParentId);
        await PutLocationAsync(Guid.Parse(child.GetProperty("id").GetString()!), body);
    }

    var directTrailLinks = allTrails.EnumerateArray()
        .SelectMany(t => t.GetProperty("locations").EnumerateArray()
            .Where(l => Guid.Parse(l.GetProperty("id").GetString()!) == regionId)
            .Select(l => (Trail: t, Link: l)))
        .ToList();

    foreach (var (trail, link) in directTrailLinks)
    {
        var lat = GetNullableDouble(trail, "startLatitude");
        var lng = GetNullableDouble(trail, "startLongitude");
        if (lat is null || lng is null) continue; // nothing to test
        var point = new Point(lng.Value, lat.Value) { SRID = 4326 };
        if (polygon.Contains(point)) continue;

        var trailId = Guid.Parse(trail.GetProperty("id").GetString()!);
        var trailName = trail.GetProperty("name").GetString();
        var role = link.GetProperty("role").GetString()!;
        var actual = DetermineAnyRegion(lat, lng);
        if (actual == null)
        {
            Console.WriteLine($"  MISMATCH: trail '{trailName}' direct link under {regionName} is outside {regionName}'s new polygon and outside every other region's polygon too — UNRESOLVED, manual fix needed.");
            continue;
        }

        Console.WriteLine($"  MISMATCH: trail '{trailName}' direct link under {regionName} is actually inside {actual} — reassigning.");
        if (!apply) continue;
        if (!allFinalRegionIds.TryGetValue(actual, out var newLocationId))
        {
            Console.WriteLine($"    Skipped: {actual}'s Id isn't known yet in this run — re-run this tool once more after this pass completes.");
            continue;
        }
        var linked = await PostTrailLocationAsync(trailId, newLocationId, role);
        if (!linked)
        {
            Console.WriteLine($"    UNRESOLVED: trail '{trailName}' link to {actual} failed to create — leaving the old link under {regionName} in place, not deleting it.");
            continue;
        }
        await DeleteTrailLocationAsync(trailId, regionId);
    }
}

if (failedPutLocationIds.Count > 0)
{
    Console.WriteLine($"── {failedPutLocationIds.Count} PUT location failure(s): {string.Join(", ", failedPutLocationIds)} ──");
}

Console.WriteLine(apply ? "Done (--apply)." : "Done (--dry-run — no changes made).");
return failedPutLocationIds.Count > 0 ? 1 : 0;

// ── helpers ──

Polygon AsPolygon(Geometry geometry, string label)
{
    if (geometry is not Polygon polygon)
        throw new InvalidOperationException($"{label}: expected a Polygon, got {geometry.GeometryType}.");
    return polygon;
}

void ValidateAndStore(string regionName, Polygon polygon)
{
    polygon.SRID = 4326;
    // Same rule LocationBoundaryParser enforces server-side — fail loudly here rather than have
    // the admin API's validator reject it later with a less specific error.
    if (!polygon.IsSimple || !polygon.IsValid)
        throw new InvalidOperationException($"{regionName}: polygon is not simple/valid.");
    finalPolygons[regionName] = polygon;
}

async Task<JsonElement> FetchAllLocationsAsync()
{
    var result = await http.GetFromJsonAsync<JsonElement>($"{adminApiUrl}/api/v1/admin/locations");
    return result;
}

async Task<JsonElement> FetchAllTrailsAsync()
{
    var result = await http.GetFromJsonAsync<JsonElement>($"{adminApiUrl}/api/v1/admin/trails?includeArchived=true");
    return result;
}

double? GetNullableDouble(JsonElement element, string property) =>
    element.TryGetProperty(property, out var value) && value.ValueKind != JsonValueKind.Null
        ? value.GetDouble()
        : null;

string? GetNullableString(JsonElement element, string property) =>
    element.TryGetProperty(property, out var value) && value.ValueKind != JsonValueKind.Null
        ? value.GetString()
        : null;

object BuildUpdateBody(
    JsonElement match, string? boundaryGeoJson = null,
    string? overrideName = null, string? overrideNameEn = null, string? overrideSlug = null,
    Guid? overrideParentId = null)
{
    return new
    {
        id = match.GetProperty("id").GetString(),
        name = overrideName ?? match.GetProperty("name").GetString(),
        nameEn = overrideNameEn ?? GetNullableString(match, "nameEn"),
        slug = overrideSlug ?? match.GetProperty("slug").GetString(),
        description = GetNullableString(match, "description"),
        descriptionEn = GetNullableString(match, "descriptionEn"),
        type = match.GetProperty("type").GetString(),
        parentId = overrideParentId?.ToString() ?? GetNullableString(match, "parentId"),
        latitude = GetNullableDouble(match, "latitude"),
        longitude = GetNullableDouble(match, "longitude"),
        radius = GetNullableDouble(match, "radius"),
        updatedBy = "import-landsvaedi-regions-script",
        boundaryGeoJson,
    };
}

async Task PutLocationAsync(Guid id, object body)
{
    if (!apply)
    {
        Console.WriteLine($"  [dry-run] would PUT /api/v1/admin/locations/{id}");
        return;
    }
    var response = await http.PutAsJsonAsync($"{adminApiUrl}/api/v1/admin/locations/{id}", body);
    Console.WriteLine($"  PUT /api/v1/admin/locations/{id} -> {(int)response.StatusCode}");
    if (!response.IsSuccessStatusCode)
    {
        Console.WriteLine($"  UNRESOLVED: PUT /api/v1/admin/locations/{id} failed with status {(int)response.StatusCode} — needs manual reassignment.");
        failedPutLocationIds.Add(id);
    }
}

async Task UpdateBoundaryOnlyAsync(string regionName, Guid id)
{
    Console.WriteLine($"── {regionName} (boundary only) ──");
    var match = allLocations.EnumerateArray().First(l => Guid.Parse(l.GetProperty("id").GetString()!) == id);
    var body = BuildUpdateBody(match, boundaryGeoJson: geoJsonWriter.Write(finalPolygons[regionName]));
    await PutLocationAsync(id, body);
}

async Task<Guid?> CreateRegionAsync(string name, Polygon polygon, Guid parentId)
{
    if (!apply)
    {
        Console.WriteLine($"  [dry-run] would POST /api/v1/admin/locations (create '{name}', parent {parentId})");
        return null;
    }
    var body = new
    {
        name,
        nameEn = name, // proper noun, not translated — same convention as the rest of this region tree
        type = "Region",
        parentId = parentId.ToString(),
        boundaryGeoJson = geoJsonWriter.Write(polygon),
    };
    var response = await http.PostAsJsonAsync($"{adminApiUrl}/api/v1/admin/locations", body);
    Console.WriteLine($"  POST /api/v1/admin/locations -> {(int)response.StatusCode}");
    response.EnsureSuccessStatusCode();
    var created = await response.Content.ReadFromJsonAsync<JsonElement>();
    return Guid.Parse(created.GetProperty("id").GetString()!);
}

// Returns whether the new link was actually created. The caller must check this before deleting
// the old link — a failed/transient POST must never be followed by the DELETE, or a trail's only
// direct region link is silently lost with no UNRESOLVED log line (review fix, PR #1766).
async Task<bool> PostTrailLocationAsync(Guid trailId, Guid locationId, string role)
{
    if (!apply)
    {
        Console.WriteLine($"    [dry-run] would POST /api/v1/admin/trails/{trailId}/locations (location {locationId}, role {role})");
        return true;
    }
    var response = await http.PostAsJsonAsync(
        $"{adminApiUrl}/api/v1/admin/trails/{trailId}/locations",
        new { locationId, role });
    Console.WriteLine($"    POST /api/v1/admin/trails/{trailId}/locations -> {(int)response.StatusCode}");
    return response.IsSuccessStatusCode;
}

async Task DeleteTrailLocationAsync(Guid trailId, Guid locationId)
{
    if (!apply)
    {
        Console.WriteLine($"    [dry-run] would DELETE /api/v1/admin/trails/{trailId}/locations/{locationId}");
        return;
    }
    var response = await http.DeleteAsync($"{adminApiUrl}/api/v1/admin/trails/{trailId}/locations/{locationId}");
    Console.WriteLine($"    DELETE /api/v1/admin/trails/{trailId}/locations/{locationId} -> {(int)response.StatusCode}");
}

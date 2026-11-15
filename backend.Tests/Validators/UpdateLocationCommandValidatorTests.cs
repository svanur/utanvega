using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Locations.Commands.UpdateLocation;

namespace backend.Tests.Validators;

// #1705: UpdateLocationCommandValidator mirrors CreateLocationCommandValidator's BoundaryGeoJson
// rule exactly (see LocationBoundaryParser) — only the boundary cases are covered here since the
// rest of the validator's rules (Name/Slug/Type/Lat/Lon/Radius) are the same pattern already
// covered by CreateLocationCommandValidatorTests.
public class UpdateLocationCommandValidatorTests
{
    private readonly UpdateLocationCommandValidator _validator = new();

    private UpdateLocationCommand ValidCommand => new(
        Id: Guid.NewGuid(),
        Name: "Reykjavík",
        Slug: "reykjavik",
        Description: "Capital of Iceland",
        Type: "Municipality",
        ParentId: null,
        Latitude: 64.1466,
        Longitude: -21.9426,
        Radius: 15,
        UpdatedBy: "user-1"
    );

    [Fact]
    public void NullBoundaryGeoJson_Passes()
    {
        var cmd = ValidCommand with { BoundaryGeoJson = null };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    // #1706 review fix: "" is the explicit "clear the boundary" sentinel the admin UI sends after
    // a Geoman removal — unlike every other malformed non-null value, it must not be run through
    // LocationBoundaryParser (which would reject it as "not valid GeoJSON").
    [Fact]
    public void EmptyStringBoundaryGeoJson_Passes()
    {
        var cmd = ValidCommand with { BoundaryGeoJson = "" };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    [Fact]
    public void ValidPolygonBoundaryGeoJson_Passes()
    {
        var cmd = ValidCommand with
        {
            BoundaryGeoJson = """
                {"type":"Polygon","coordinates":[[[-21.95,64.10],[-21.90,64.10],[-21.90,64.15],[-21.95,64.15],[-21.95,64.10]]]}
                """
        };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    [Fact]
    public void NotValidGeoJson_Fails()
    {
        var cmd = ValidCommand with { BoundaryGeoJson = "this is not geojson" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    [Fact]
    public void WrongGeometryType_Point_Fails()
    {
        var cmd = ValidCommand with
        {
            BoundaryGeoJson = """{"type":"Point","coordinates":[-21.9426,64.1466]}"""
        };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    [Fact]
    public void SelfIntersectingRing_Fails()
    {
        // Bowtie quad — the two diagonals cross, so the ring is not simple.
        var cmd = ValidCommand with
        {
            BoundaryGeoJson = """
                {"type":"Polygon","coordinates":[[[0,0],[1,1],[1,0],[0,1],[0,0]]]}
                """
        };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    // ─── BoundaryGeoJson size/vertex caps (#1714) ───

    [Fact]
    public void BoundaryGeoJsonExceedsPayloadSizeCap_Fails()
    {
        // LocationBoundaryParser checks raw string length before attempting to parse anything, so
        // padding a valid polygon with trailing whitespace past the cap is enough to exercise this
        // check in isolation from the vertex-count one below.
        var oversized = """{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}""" +
                         new string(' ', 500_000);
        var cmd = ValidCommand with { BoundaryGeoJson = oversized };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    [Fact]
    public void BoundaryGeoJsonExceedsByteSizeCapOnly_Fails()
    {
        // #1736: multi-byte UTF-8 chars (3 bytes each) keep string.Length well under the 500,000
        // char/byte cap value while the actual UTF-8 byte count exceeds it — proves the cap is
        // enforced in bytes, not chars.
        var cmd = ValidCommand with
        {
            BoundaryGeoJson = BoundaryGeoJsonFixtures.BuildPayloadWithMultiByteCharsExceedingByteCap()
        };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    [Fact]
    public void BoundaryGeoJsonExceedsVertexCountCap_Fails()
    {
        // 50,001 vertices via a minimal "[x,0]" per point keeps the raw payload at ~300 KB — well
        // under the payload-size cap above — so this exercises the vertex-count cap specifically.
        var cmd = ValidCommand with { BoundaryGeoJson = BoundaryGeoJsonFixtures.BuildPolygonWithVertexCount(50_001) };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    [Fact]
    public void RealImportedMunicipalityBoundary_WithinBothCaps_Passes()
    {
        // The actual Reykjavík boundary bundled by PR #1713 (admin/public/data/
        // municipality-boundaries.geojson) — the largest of the 4 imported municipalities at 403
        // vertices / ~7.6 KB. Confirms the caps chosen above don't clip real production data.
        var cmd = ValidCommand with { BoundaryGeoJson = BoundaryGeoJsonFixtures.ReykjavikBoundaryGeoJson };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }
}

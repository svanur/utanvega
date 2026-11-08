using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Locations.Commands.CreateLocation;

namespace backend.Tests.Validators;

public class CreateLocationCommandValidatorTests
{
    private readonly CreateLocationCommandValidator _validator = new();

    private CreateLocationCommand ValidCommand => new(
        Name: "Reykjavík",
        Slug: "reykjavik",
        Description: "Capital of Iceland",
        Type: "Municipality",
        ParentId: null,
        Latitude: 64.1466,
        Longitude: -21.9426,
        Radius: 15,
        CreatedBy: "user-1"
    );

    [Fact]
    public void ValidCommand_PassesValidation()
    {
        var result = _validator.TestValidate(ValidCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyName_Fails()
    {
        var cmd = ValidCommand with { Name = "" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void InvalidType_Fails()
    {
        var cmd = ValidCommand with { Type = "Galaxy" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Theory]
    [InlineData("Country")]
    [InlineData("Area")]
    [InlineData("Region")]
    [InlineData("Municipality")]
    [InlineData("Place")]
    [InlineData("Other")]
    public void ValidType_Passes(string type)
    {
        var cmd = ValidCommand with { Type = type };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void LatitudeOutOfRange_Fails()
    {
        var cmd = ValidCommand with { Latitude = 91 };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Latitude);
    }

    [Fact]
    public void LongitudeOutOfRange_Fails()
    {
        var cmd = ValidCommand with { Longitude = 181 };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Longitude);
    }

    [Fact]
    public void NegativeRadius_Fails()
    {
        var cmd = ValidCommand with { Radius = -5 };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Radius);
    }

    [Fact]
    public void ZeroRadius_Fails()
    {
        var cmd = ValidCommand with { Radius = 0 };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Radius);
    }

    [Fact]
    public void NullCoordinates_Passes()
    {
        var cmd = ValidCommand with { Latitude = null, Longitude = null, Radius = null };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void NullSlug_Passes()
    {
        var cmd = ValidCommand with { Slug = null };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void InvalidSlugFormat_Fails()
    {
        var cmd = ValidCommand with { Slug = "Not A Slug!" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    // ─── BoundaryGeoJson (#1705) ───

    [Fact]
    public void NullBoundaryGeoJson_Passes()
    {
        var cmd = ValidCommand with { BoundaryGeoJson = null };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.BoundaryGeoJson);
    }

    // #1706 review fix: "" is UpdateLocationCommand's explicit "clear the boundary" sentinel — a
    // brand-new Location never has a Boundary to clear, but the admin dialog can still send "" for
    // one (e.g. loaded then removed an official boundary before first save), so Create must accept
    // it the same as null rather than reject it as invalid GeoJSON.
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

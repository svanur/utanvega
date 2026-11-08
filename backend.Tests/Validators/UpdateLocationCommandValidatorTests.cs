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
}

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
}

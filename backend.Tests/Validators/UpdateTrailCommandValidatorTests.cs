using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Trails.Commands.UpdateTrail;

namespace backend.Tests.Validators;

public class UpdateTrailCommandValidatorTests
{
    private readonly UpdateTrailCommandValidator _validator = new();

    private UpdateTrailCommand ValidCommand => new(
        Id: Guid.NewGuid(),
        Name: "Test Trail",
        Slug: "test-trail",
        Description: "A nice trail",
        ActivityType: "TrailRunning",
        Status: "Draft",
        Type: "Loop",
        Difficulty: "Moderate",
        Visibility: "Public",
        UpdatedBy: "user-1"
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
    public void NameExceedsMaxLength_Fails()
    {
        var cmd = ValidCommand with { Name = new string('a', 201) };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void InvalidSlug_Fails()
    {
        var cmd = ValidCommand with { Slug = "Invalid Slug!" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void EmptySlug_Fails()
    {
        var cmd = ValidCommand with { Slug = "" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Theory]
    [InlineData("TrailRunning")]
    [InlineData("Running")]
    [InlineData("Cycling")]
    [InlineData("Hiking")]
    public void ValidActivityType_Passes(string activityType)
    {
        var cmd = ValidCommand with { ActivityType = activityType };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.ActivityType);
    }

    [Fact]
    public void InvalidActivityType_Fails()
    {
        var cmd = ValidCommand with { ActivityType = "Swimming" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.ActivityType);
    }

    [Fact]
    public void InvalidStatus_Fails()
    {
        var cmd = ValidCommand with { Status = "NotAStatus" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void InvalidDifficulty_Fails()
    {
        var cmd = ValidCommand with { Difficulty = "Impossible" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Difficulty);
    }

    [Fact]
    public void InvalidVisibility_Fails()
    {
        var cmd = ValidCommand with { Visibility = "Secret" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Visibility);
    }

    [Fact]
    public void InvalidType_Fails()
    {
        var cmd = ValidCommand with { Type = "Spiral" };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void EmptyId_Fails()
    {
        var cmd = ValidCommand with { Id = Guid.Empty };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void NullDescription_Passes()
    {
        var cmd = ValidCommand with { Description = null };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void DescriptionExceedsMaxLength_Fails()
    {
        var cmd = ValidCommand with { Description = new string('a', 5001) };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void ValidLocations_Passes()
    {
        var cmd = ValidCommand with
        {
            Locations = [new TrailLocationUpdateDto(Guid.NewGuid(), "Start", 0)]
        };
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void InvalidLocationRole_Fails()
    {
        var cmd = ValidCommand with
        {
            Locations = [new TrailLocationUpdateDto(Guid.NewGuid(), "InvalidRole", 0)]
        };
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }
}

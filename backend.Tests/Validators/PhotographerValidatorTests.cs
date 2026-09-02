using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Photographers;
using Utanvega.Backend.Core.Entities;

namespace backend.Tests.Validators;

public class PhotographerValidatorTests
{
    // ─── UpdatePhotographerCommandValidator ───

    private readonly UpdatePhotographerCommandValidator _updatePhotographerValidator = new();

    private UpdatePhotographerCommand ValidUpdatePhotographerCommand => new(
        Id: Guid.NewGuid(),
        Name: "Jón Jónsson",
        Website: null,
        Email: null,
        Description: null
    );

    [Fact]
    public void UpdatePhotographer_ValidCommand_Passes()
    {
        var result = _updatePhotographerValidator.TestValidate(ValidUpdatePhotographerCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdatePhotographer_EmptyId_Fails()
    {
        var cmd = ValidUpdatePhotographerCommand with { Id = Guid.Empty };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void UpdatePhotographer_NullSlug_Passes()
    {
        var cmd = ValidUpdatePhotographerCommand with { Slug = null };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdatePhotographer_BlankSlug_Passes()
    {
        // Blank is what UpdatePhotographerCommand's handler treats as "no change requested" — it
        // must not be rejected by validation before it even reaches that no-op branch.
        var cmd = ValidUpdatePhotographerCommand with { Slug = "   " };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdatePhotographer_MalformedSlug_Fails()
    {
        var cmd = ValidUpdatePhotographerCommand with { Slug = "Not A Slug!!!" };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdatePhotographer_ValidSlug_Passes()
    {
        var cmd = ValidUpdatePhotographerCommand with { Slug = "new-photographer-slug" };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdatePhotographer_NullSocialLinks_Passes()
    {
        var cmd = ValidUpdatePhotographerCommand with { SocialLinks = null };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdatePhotographer_ValidSocialLinks_Passes()
    {
        var cmd = ValidUpdatePhotographerCommand with
        {
            SocialLinks = [new SocialLink { Type = "Instagram", Url = "https://instagram.com/photog" }]
        };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdatePhotographer_SocialLinkMissingType_Fails()
    {
        var cmd = ValidUpdatePhotographerCommand with
        {
            SocialLinks = [new SocialLink { Type = "", Url = "https://instagram.com/photog" }]
        };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void UpdatePhotographer_NonHttpSocialLink_Fails()
    {
        var cmd = ValidUpdatePhotographerCommand with
        {
            SocialLinks = [new SocialLink { Type = "Suspicious", Url = "ftp://example.com/file" }]
        };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void UpdatePhotographer_NullWebsite_Passes()
    {
        var cmd = ValidUpdatePhotographerCommand with { Website = null };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Website);
    }

    [Fact]
    public void UpdatePhotographer_HttpsWebsite_Passes()
    {
        var cmd = ValidUpdatePhotographerCommand with { Website = "https://jonjonsson.is" };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Website);
    }

    [Fact]
    public void UpdatePhotographer_JavascriptSchemeWebsite_Fails()
    {
        var cmd = ValidUpdatePhotographerCommand with { Website = "javascript:alert(1)" };
        var result = _updatePhotographerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Website);
    }

    // ─── CreatePhotographerCommandValidator ───

    private readonly CreatePhotographerCommandValidator _createPhotographerValidator = new();

    private CreatePhotographerCommand ValidCreatePhotographerCommand => new(
        Name: "Jón Jónsson",
        Website: null,
        Email: null,
        Description: null
    );

    [Fact]
    public void CreatePhotographer_ValidCommand_Passes()
    {
        var result = _createPhotographerValidator.TestValidate(ValidCreatePhotographerCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreatePhotographer_EmptyName_Fails()
    {
        var cmd = ValidCreatePhotographerCommand with { Name = "" };
        var result = _createPhotographerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreatePhotographer_OverLengthName_Fails()
    {
        var cmd = ValidCreatePhotographerCommand with { Name = new string('a', 201) };
        var result = _createPhotographerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreatePhotographer_HttpsWebsite_Passes()
    {
        var cmd = ValidCreatePhotographerCommand with { Website = "https://jonjonsson.is" };
        var result = _createPhotographerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Website);
    }

    [Fact]
    public void CreatePhotographer_JavascriptSchemeWebsite_Fails()
    {
        var cmd = ValidCreatePhotographerCommand with { Website = "javascript:alert(1)" };
        var result = _createPhotographerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Website);
    }
}

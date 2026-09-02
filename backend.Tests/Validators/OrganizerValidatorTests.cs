using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Organizers;
using Utanvega.Backend.Core.Entities;

namespace backend.Tests.Validators;

public class OrganizerValidatorTests
{
    // ─── UpdateOrganizerCommandValidator ───

    private readonly UpdateOrganizerCommandValidator _updateOrganizerValidator = new();

    private UpdateOrganizerCommand ValidUpdateOrganizerCommand => new(
        Id: Guid.NewGuid(),
        Name: "Reykjavík Marathon Club",
        Kennitala: null,
        Phone: null,
        Email: null,
        Website: null,
        Description: null,
        ContactName: null
    );

    [Fact]
    public void UpdateOrganizer_ValidCommand_Passes()
    {
        var result = _updateOrganizerValidator.TestValidate(ValidUpdateOrganizerCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateOrganizer_EmptyId_Fails()
    {
        var cmd = ValidUpdateOrganizerCommand with { Id = Guid.Empty };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void UpdateOrganizer_NullSlug_Passes()
    {
        var cmd = ValidUpdateOrganizerCommand with { Slug = null };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdateOrganizer_BlankSlug_Passes()
    {
        // Blank is what UpdateOrganizerCommand's handler treats as "no change requested" — it must
        // not be rejected by validation before it even reaches that no-op branch.
        var cmd = ValidUpdateOrganizerCommand with { Slug = "   " };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdateOrganizer_MalformedSlug_Fails()
    {
        var cmd = ValidUpdateOrganizerCommand with { Slug = "Not A Slug!!!" };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdateOrganizer_ValidSlug_Passes()
    {
        var cmd = ValidUpdateOrganizerCommand with { Slug = "new-organizer-slug" };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdateOrganizer_NullSocialLinks_Passes()
    {
        var cmd = ValidUpdateOrganizerCommand with { SocialLinks = null };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateOrganizer_ValidSocialLinks_Passes()
    {
        var cmd = ValidUpdateOrganizerCommand with
        {
            SocialLinks = [new SocialLink { Type = "Facebook", Url = "https://facebook.com/org" }]
        };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateOrganizer_SocialLinkMissingType_Fails()
    {
        var cmd = ValidUpdateOrganizerCommand with
        {
            SocialLinks = [new SocialLink { Type = "", Url = "https://facebook.com/org" }]
        };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void UpdateOrganizer_NonHttpSocialLink_Fails()
    {
        var cmd = ValidUpdateOrganizerCommand with
        {
            SocialLinks = [new SocialLink { Type = "Suspicious", Url = "ftp://example.com/file" }]
        };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void UpdateOrganizer_NullWebsite_Passes()
    {
        var cmd = ValidUpdateOrganizerCommand with { Website = null };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Website);
    }

    [Fact]
    public void UpdateOrganizer_HttpsWebsite_Passes()
    {
        var cmd = ValidUpdateOrganizerCommand with { Website = "https://reykjavikmarathon.is" };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Website);
    }

    [Fact]
    public void UpdateOrganizer_JavascriptSchemeWebsite_Fails()
    {
        var cmd = ValidUpdateOrganizerCommand with { Website = "javascript:alert(1)" };
        var result = _updateOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Website);
    }

    // ─── CreateOrganizerCommandValidator ───

    private readonly CreateOrganizerCommandValidator _createOrganizerValidator = new();

    private CreateOrganizerCommand ValidCreateOrganizerCommand => new(
        Name: "Reykjavík Marathon Club",
        Kennitala: null,
        Phone: null,
        Email: null,
        Website: null,
        Description: null,
        ContactName: null
    );

    [Fact]
    public void CreateOrganizer_ValidCommand_Passes()
    {
        var result = _createOrganizerValidator.TestValidate(ValidCreateOrganizerCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateOrganizer_EmptyName_Fails()
    {
        var cmd = ValidCreateOrganizerCommand with { Name = "" };
        var result = _createOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateOrganizer_OverLengthName_Fails()
    {
        var cmd = ValidCreateOrganizerCommand with { Name = new string('a', 201) };
        var result = _createOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateOrganizer_HttpsWebsite_Passes()
    {
        var cmd = ValidCreateOrganizerCommand with { Website = "https://reykjavikmarathon.is" };
        var result = _createOrganizerValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Website);
    }

    [Fact]
    public void CreateOrganizer_JavascriptSchemeWebsite_Fails()
    {
        var cmd = ValidCreateOrganizerCommand with { Website = "javascript:alert(1)" };
        var result = _createOrganizerValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Website);
    }
}

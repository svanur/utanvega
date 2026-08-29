using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Organizers;

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
}

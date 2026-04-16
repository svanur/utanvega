using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Competitions.Commands.CreateCompetition;
using Utanvega.Backend.Application.Competitions.Commands.UpdateCompetition;
using Utanvega.Backend.Application.Competitions.Commands.CreateRace;

namespace backend.Tests.Validators;

public class CompetitionValidatorTests
{
    // ─── CreateCompetitionCommandValidator ───

    private readonly CreateCompetitionCommandValidator _createValidator = new();

    private CreateCompetitionCommand ValidCreateCommand => new(
        Name: "Laugavegur Ultra Marathon",
        Slug: "laugavegur-ultra",
        Description: "55K ultra through the highlands",
        OrganizerName: "ÍSÍ",
        OrganizerWebsite: "https://marathon.is",
        RegistrationUrl: null,
        AlertMessage: null,
        AlertSeverity: null,
        LocationId: null,
        Status: "Active",
        ScheduleRule: null
    );

    [Fact]
    public void CreateCompetition_ValidCommand_Passes()
    {
        var result = _createValidator.TestValidate(ValidCreateCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateCompetition_EmptyName_Fails()
    {
        var cmd = ValidCreateCommand with { Name = "" };
        var result = _createValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateCompetition_TooLongName_Fails()
    {
        var cmd = ValidCreateCommand with { Name = new string('A', 201) };
        var result = _createValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateCompetition_InvalidSlug_Fails()
    {
        var cmd = ValidCreateCommand with { Slug = "Invalid Slug!!!" };
        var result = _createValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void CreateCompetition_NullSlug_Passes()
    {
        var cmd = ValidCreateCommand with { Slug = null };
        var result = _createValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void CreateCompetition_InvalidStatus_Fails()
    {
        var cmd = ValidCreateCommand with { Status = "NotAStatus" };
        var result = _createValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void CreateCompetition_InvalidUrl_Fails()
    {
        var cmd = ValidCreateCommand with { OrganizerWebsite = "not-a-url" };
        var result = _createValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.OrganizerWebsite);
    }

    [Fact]
    public void CreateCompetition_NullUrl_Passes()
    {
        var cmd = ValidCreateCommand with { OrganizerWebsite = null };
        var result = _createValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.OrganizerWebsite);
    }

    // ─── UpdateCompetitionCommandValidator ───

    private readonly UpdateCompetitionCommandValidator _updateValidator = new();

    private UpdateCompetitionCommand ValidUpdateCommand => new(
        Id: Guid.NewGuid(),
        Name: "Updated Name",
        Description: null,
        OrganizerName: null,
        OrganizerWebsite: null,
        RegistrationUrl: null,
        AlertMessage: null,
        AlertSeverity: null,
        LocationId: null,
        Status: "Active",
        ScheduleRule: null
    );

    [Fact]
    public void UpdateCompetition_ValidCommand_Passes()
    {
        var result = _updateValidator.TestValidate(ValidUpdateCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateCompetition_EmptyId_Fails()
    {
        var cmd = ValidUpdateCommand with { Id = Guid.Empty };
        var result = _updateValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void UpdateCompetition_EmptyName_Fails()
    {
        var cmd = ValidUpdateCommand with { Name = "" };
        var result = _updateValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void UpdateCompetition_InvalidStatus_Fails()
    {
        var cmd = ValidUpdateCommand with { Status = "Bogus" };
        var result = _updateValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    // ─── CreateRaceCommandValidator ───

    private readonly CreateRaceCommandValidator _raceValidator = new();

    private CreateRaceCommand ValidRaceCommand => new(
        CompetitionId: Guid.NewGuid(),
        TrailId: null,
        Name: "55K Ultra",
        DistanceLabel: "55 km",
        CutoffMinutes: 720,
        Description: null,
        Status: "Active",
        SortOrder: 0
    );

    [Fact]
    public void CreateRace_ValidCommand_Passes()
    {
        var result = _raceValidator.TestValidate(ValidRaceCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateRace_EmptyCompetitionId_Fails()
    {
        var cmd = ValidRaceCommand with { CompetitionId = Guid.Empty };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.CompetitionId);
    }

    [Fact]
    public void CreateRace_EmptyName_Fails()
    {
        var cmd = ValidRaceCommand with { Name = "" };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateRace_NegativeCutoff_Fails()
    {
        var cmd = ValidRaceCommand with { CutoffMinutes = -10 };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.CutoffMinutes);
    }

    [Fact]
    public void CreateRace_NegativeSortOrder_Fails()
    {
        var cmd = ValidRaceCommand with { SortOrder = -1 };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.SortOrder);
    }
}

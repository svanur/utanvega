using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Events.Commands.CreateEvent;
using Utanvega.Backend.Application.Events.Commands.UpdateEvent;
using Utanvega.Backend.Application.Events.Commands.CreateEdition;
using Utanvega.Backend.Application.Events.Commands.UpdateEdition;
using Utanvega.Backend.Application.Events.Commands.CreateRace;
using Utanvega.Backend.Application.Events.Commands.UpdateRace;
using Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;
using Utanvega.Backend.Core.Entities;

namespace backend.Tests.Validators;

public class EventValidatorTests
{
    // ─── CreateEventCommandValidator ───

    private readonly CreateEventCommandValidator _createEventValidator = new();

    private CreateEventCommand ValidCreateEventCommand => new(
        Name: "Laugavegur Ultra Marathon",
        Slug: "laugavegur-ultra",
        Description: "55K ultra through the highlands",
        Type: "Race",
        ActivityType: "TrailRunning",
        Status: "Confirmed",
        OrganizerName: "ÍSÍ",
        OrganizerWebsite: "https://marathon.is",
        AlertMessage: null,
        AlertSeverity: null,
        LocationId: null,
        ScheduleRule: null,
        SocialLinks: null
    );

    [Fact]
    public void CreateEvent_ValidCommand_Passes()
    {
        var result = _createEventValidator.TestValidate(ValidCreateEventCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateEvent_EmptyName_Fails()
    {
        var cmd = ValidCreateEventCommand with { Name = "" };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateEvent_TooLongName_Fails()
    {
        var cmd = ValidCreateEventCommand with { Name = new string('A', 201) };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateEvent_InvalidSlug_Fails()
    {
        var cmd = ValidCreateEventCommand with { Slug = "Invalid Slug!!!" };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void CreateEvent_NullSlug_Passes()
    {
        var cmd = ValidCreateEventCommand with { Slug = null };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void CreateEvent_InvalidType_Fails()
    {
        var cmd = ValidCreateEventCommand with { Type = "NotAType" };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void CreateEvent_InvalidStatus_Fails()
    {
        var cmd = ValidCreateEventCommand with { Status = "NotAStatus" };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void CreateEvent_InvalidUrl_Fails()
    {
        var cmd = ValidCreateEventCommand with { OrganizerWebsite = "not-a-url" };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.OrganizerWebsite);
    }

    [Fact]
    public void CreateEvent_NullUrl_Passes()
    {
        var cmd = ValidCreateEventCommand with { OrganizerWebsite = null };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.OrganizerWebsite);
    }

    [Fact]
    public void CreateEvent_InvalidSocialLink_Fails()
    {
        var cmd = ValidCreateEventCommand with
        {
            SocialLinks = [new SocialLink { Type = "Facebook", Url = "not-a-url" }]
        };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void CreateEvent_ValidSocialLinks_Passes()
    {
        var cmd = ValidCreateEventCommand with
        {
            SocialLinks = [new SocialLink { Type = "Facebook", Url = "https://facebook.com/event" }]
        };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateEvent_NonHttpSocialLink_Fails()
    {
        var cmd = ValidCreateEventCommand with
        {
            SocialLinks = [new SocialLink { Type = "Suspicious", Url = "ftp://example.com/file" }]
        };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    // ─── UpdateEventCommandValidator ───

    private readonly UpdateEventCommandValidator _updateEventValidator = new();

    private UpdateEventCommand ValidUpdateEventCommand => new(
        Id: Guid.NewGuid(),
        Name: "Updated Name",
        Description: null,
        Type: "Race",
        ActivityType: "TrailRunning",
        Status: "Confirmed",
        OrganizerName: null,
        OrganizerWebsite: null,
        AlertMessage: null,
        AlertSeverity: null,
        LocationId: null,
        ScheduleRule: null,
        SocialLinks: null
    );

    [Fact]
    public void UpdateEvent_ValidCommand_Passes()
    {
        var result = _updateEventValidator.TestValidate(ValidUpdateEventCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateEvent_EmptyId_Fails()
    {
        var cmd = ValidUpdateEventCommand with { Id = Guid.Empty };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void UpdateEvent_EmptyName_Fails()
    {
        var cmd = ValidUpdateEventCommand with { Name = "" };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void UpdateEvent_InvalidStatus_Fails()
    {
        var cmd = ValidUpdateEventCommand with { Status = "Bogus" };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void UpdateEvent_NonHttpSocialLink_Fails()
    {
        var cmd = ValidUpdateEventCommand with
        {
            SocialLinks = [new SocialLink { Type = "Suspicious", Url = "ftp://example.com/file" }]
        };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    // ─── CreateEditionCommandValidator ───

    private readonly CreateEditionCommandValidator _createEditionValidator = new();

    private CreateEditionCommand ValidCreateEditionCommand => new(
        EventId: Guid.NewGuid(),
        Year: 2025,
        Date: new DateOnly(2025, 7, 12),
        Title: "2025 Edition",
        RegistrationUrl: "https://register.is",
        ResultsUrl: null,
        Notes: null,
        RegistrationStatus: "Open",
        TrailId: null
    );

    [Fact]
    public void CreateEdition_ValidCommand_Passes()
    {
        var result = _createEditionValidator.TestValidate(ValidCreateEditionCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateEdition_EmptyEventId_Fails()
    {
        var cmd = ValidCreateEditionCommand with { EventId = Guid.Empty };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EventId);
    }

    [Fact]
    public void CreateEdition_InvalidRegistrationUrl_Fails()
    {
        var cmd = ValidCreateEditionCommand with { RegistrationUrl = "not-url" };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.RegistrationUrl);
    }

    [Fact]
    public void CreateEdition_InvalidRegistrationStatus_Fails()
    {
        var cmd = ValidCreateEditionCommand with { RegistrationStatus = "Invalid" };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.RegistrationStatus);
    }

    [Fact]
    public void CreateEdition_YearOutOfRange_Fails()
    {
        var cmd = ValidCreateEditionCommand with { Year = 1999 };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Year);
    }

    // ─── UpdateEditionCommandValidator ───

    private readonly UpdateEditionCommandValidator _updateEditionValidator = new();

    private UpdateEditionCommand ValidUpdateEditionCommand => new(
        Id: Guid.NewGuid(),
        Year: 2025,
        Date: new DateOnly(2025, 7, 12),
        Title: "Updated Edition",
        RegistrationUrl: "https://register.is",
        ResultsUrl: "https://results.is",
        Notes: null,
        RegistrationStatus: "Closed",
        TrailId: null
    );

    [Fact]
    public void UpdateEdition_ValidCommand_Passes()
    {
        var result = _updateEditionValidator.TestValidate(ValidUpdateEditionCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateEdition_EmptyId_Fails()
    {
        var cmd = ValidUpdateEditionCommand with { Id = Guid.Empty };
        var result = _updateEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void UpdateEdition_InvalidResultsUrl_Fails()
    {
        var cmd = ValidUpdateEditionCommand with { ResultsUrl = "bad-url" };
        var result = _updateEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.ResultsUrl);
    }

    // ─── CreateRaceCommandValidator ───

    private readonly CreateRaceCommandValidator _raceValidator = new();

    private static CreateRaceCommand ValidRaceCommand => new(
        EventEditionId: Guid.NewGuid(),
        TrailId: null,
        Name: "55K Ultra",
        DistanceLabel: "55 km",
        CutoffMinutes: 720,
        Description: null,
        Status: "Active",
        SortOrder: 0,
        TicketStatus: "Available",
        MaxParticipants: 200,
        ItraPoints: 4,
        CertifiedBy: "ITRA",
        PrizeMoney: 1000m,
        ChampionshipCategory: null,
        DateOfRace: null,
        StartTime: null
    );

    [Fact]
    public void CreateRace_ValidCommand_Passes()
    {
        var result = _raceValidator.TestValidate(ValidRaceCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateRace_EmptyEditionId_Fails()
    {
        var cmd = ValidRaceCommand with { EventEditionId = Guid.Empty };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EventEditionId);
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

    [Fact]
    public void CreateRace_ItraPointsOutOfRange_Fails()
    {
        var cmd = ValidRaceCommand with { ItraPoints = 7 };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.ItraPoints);
    }

    [Fact]
    public void CreateRace_NullItraPoints_Passes()
    {
        var cmd = ValidRaceCommand with { ItraPoints = null };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.ItraPoints);
    }

    [Fact]
    public void CreateRace_NegativePrizeMoney_Fails()
    {
        var cmd = ValidRaceCommand with { PrizeMoney = -500m };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.PrizeMoney);
    }

    [Fact]
    public void CreateRace_InvalidTicketStatus_Fails()
    {
        var cmd = ValidRaceCommand with { TicketStatus = "NotValid" };
        var result = _raceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.TicketStatus);
    }

    // ─── UpdateRaceCommandValidator ───

    private readonly UpdateRaceCommandValidator _updateRaceValidator = new();

    private UpdateRaceCommand ValidUpdateRaceCommand => new(
        Id: Guid.NewGuid(),
        TrailId: null,
        Name: "Updated Race",
        DistanceLabel: "21 km",
        CutoffMinutes: 180,
        Description: null,
        Status: "Active",
        SortOrder: 1,
        TicketStatus: "Available",
        MaxParticipants: 100,
        ItraPoints: 2,
        CertifiedBy: null,
        PrizeMoney: 0,
        ChampionshipCategory: null,
        DateOfRace: null,
        StartTime: null
    );

    [Fact]
    public void UpdateRace_ValidCommand_Passes()
    {
        var result = _updateRaceValidator.TestValidate(ValidUpdateRaceCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateRace_EmptyId_Fails()
    {
        var cmd = ValidUpdateRaceCommand with { Id = Guid.Empty };
        var result = _updateRaceValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void UpdateRace_NullItraPoints_Passes()
    {
        var cmd = ValidUpdateRaceCommand with { ItraPoints = null };
        var result = _updateRaceValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.ItraPoints);
    }

    // ─── GenerateEditionsForSeasonCommandValidator ───

    private readonly GenerateEditionsForSeasonCommandValidator _generateValidator = new();

    private GenerateEditionsForSeasonCommand ValidGenerateCommand => new(
        EventId: Guid.NewGuid(),
        From: new DateOnly(2025, 1, 1),
        To: new DateOnly(2025, 12, 31)
    );

    [Fact]
    public void GenerateEditions_ValidCommand_Passes()
    {
        var result = _generateValidator.TestValidate(ValidGenerateCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void GenerateEditions_EmptyEventId_Fails()
    {
        var cmd = ValidGenerateCommand with { EventId = Guid.Empty };
        var result = _generateValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EventId);
    }

    [Fact]
    public void GenerateEditions_ToBeforeFrom_Fails()
    {
        var cmd = ValidGenerateCommand with { From = new DateOnly(2025, 12, 31), To = new DateOnly(2025, 1, 1) };
        var result = _generateValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void GenerateEditions_RangeExceedsTwoYears_Fails()
    {
        var cmd = ValidGenerateCommand with { From = new DateOnly(2020, 1, 1), To = new DateOnly(2025, 12, 31) };
        var result = _generateValidator.TestValidate(cmd);
        result.ShouldHaveAnyValidationError();
    }
}

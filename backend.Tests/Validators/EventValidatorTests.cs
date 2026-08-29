using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Events.Commands.CreateEvent;
using Utanvega.Backend.Application.Events.Commands.UpdateEvent;
using Utanvega.Backend.Application.Events.Commands.CreateEdition;
using Utanvega.Backend.Application.Events.Commands.UpdateEdition;
using Utanvega.Backend.Application.Events.Commands.CreateRace;
using Utanvega.Backend.Application.Events.Commands.UpdateRace;
using Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Tests;

namespace backend.Tests.Validators;

public class EventValidatorTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();

    public void Dispose() => _factory.Dispose();

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
        OrganizerId: null,
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
    public void CreateEvent_NumericStatus_Fails()
    {
        // Regression: Enum.TryParse alone would have accepted this ("99" fits EventStatus's
        // underlying int type) and let it through to the handler as unvalidated input.
        var cmd = ValidCreateEventCommand with { Status = "99" };
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

    [Fact]
    public void CreateEvent_SocialType_Passes()
    {
        var cmd = ValidCreateEventCommand with { Type = "Social" };
        var result = _createEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Type);
    }

    // ─── UpdateEventCommandValidator ───

    private readonly UpdateEventCommandValidator _updateEventValidator = new();

    private UpdateEventCommand ValidUpdateEventCommand => new(
        Id: Guid.NewGuid(),
        Name: "Updated Name",
        Slug: null,
        Description: null,
        Type: "Race",
        ActivityType: "TrailRunning",
        Status: "Confirmed",
        OrganizerName: null,
        OrganizerWebsite: null,
        OrganizerId: null,
        AlertMessage: null,
        AlertSeverity: null,
        LocationId: null,
        ScheduleRule: null,
        SocialLinks: null,
        GpxPointLat: null,
        GpxPointLng: null
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
    public void UpdateEvent_NullSlug_Passes()
    {
        var cmd = ValidUpdateEventCommand with { Slug = null };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdateEvent_BlankSlug_Passes()
    {
        // Blank is what UpdateEventCommand's handler treats as "no change requested" — it must not
        // be rejected by validation before it even reaches that no-op branch.
        var cmd = ValidUpdateEventCommand with { Slug = "   " };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdateEvent_MalformedSlug_Fails()
    {
        var cmd = ValidUpdateEventCommand with { Slug = "Not A Slug!!!" };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void UpdateEvent_ValidSlug_Passes()
    {
        var cmd = ValidUpdateEventCommand with { Slug = "new-event-slug" };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Slug);
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

    [Fact]
    public void UpdateEvent_InvalidPhotoGalleryUrl_Fails()
    {
        var cmd = ValidUpdateEventCommand with { PhotoGalleryUrl = "not-a-url" };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.PhotoGalleryUrl);
    }

    [Fact]
    public void UpdateEvent_ValidPhotoGalleryUrl_Passes()
    {
        var cmd = ValidUpdateEventCommand with { PhotoGalleryUrl = "https://sportmyndir.is/album/60" };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.PhotoGalleryUrl);
    }

    [Fact]
    public void UpdateEvent_NullPhotoGalleryUrl_Passes()
    {
        var cmd = ValidUpdateEventCommand with { PhotoGalleryUrl = null };
        var result = _updateEventValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.PhotoGalleryUrl);
    }

    // ─── CreateEditionCommandValidator ───

    private readonly CreateEditionCommandValidator _createEditionValidator = new();

    private CreateEditionCommand ValidCreateEditionCommand => new(
        EventId: Guid.NewGuid(),
        Year: 2025,
        Date: new DateOnly(2025, 7, 12),
        EndDate: null,
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
    public void CreateEdition_NullStatus_Passes()
    {
        var cmd = ValidCreateEditionCommand with { Status = null };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void CreateEdition_InvalidStatus_Fails()
    {
        var cmd = ValidCreateEditionCommand with { Status = "NotAStatus" };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void CreateEdition_NumericStatus_Fails()
    {
        // Regression: Enum.TryParse alone would have accepted this ("99" fits EditionStatus's
        // underlying int type) and let it through to the handler as unvalidated input.
        var cmd = ValidCreateEditionCommand with { Status = "99" };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void CreateEdition_YearOutOfRange_Fails()
    {
        var cmd = ValidCreateEditionCommand with { Year = 1999 };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Year);
    }

    [Fact]
    public void CreateEdition_EndDateAfterDate_Passes()
    {
        var cmd = ValidCreateEditionCommand with { Date = new DateOnly(2025, 8, 1), EndDate = new DateOnly(2025, 8, 3) };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void CreateEdition_EndDateSameAsDate_Passes()
    {
        var cmd = ValidCreateEditionCommand with { Date = new DateOnly(2025, 8, 1), EndDate = new DateOnly(2025, 8, 1) };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void CreateEdition_EndDateBeforeDate_Fails()
    {
        var cmd = ValidCreateEditionCommand with { Date = new DateOnly(2025, 8, 3), EndDate = new DateOnly(2025, 8, 1) };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void CreateEdition_EndDateWithNullDate_Passes()
    {
        var cmd = ValidCreateEditionCommand with { Date = null, EndDate = new DateOnly(2025, 8, 1) };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void CreateEdition_InvalidPhotoGalleryUrl_Fails()
    {
        var cmd = ValidCreateEditionCommand with { PhotoGalleryUrl = "not-a-url" };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.PhotoGalleryUrl);
    }

    [Fact]
    public void CreateEdition_ValidPhotoGalleryUrl_Passes()
    {
        var cmd = ValidCreateEditionCommand with { PhotoGalleryUrl = "https://sportmyndir.is/album/60" };
        var result = _createEditionValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.PhotoGalleryUrl);
    }

    // ─── UpdateEditionCommandValidator ───

    private readonly UpdateEditionCommandValidator _updateEditionValidator = new();

    private UpdateEditionCommand ValidUpdateEditionCommand => new(
        Id: Guid.NewGuid(),
        Year: 2025,
        Date: new DateOnly(2025, 7, 12),
        EndDate: null,
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
    public void UpdateEdition_InvalidPhotoGalleryUrl_Fails()
    {
        var cmd = ValidUpdateEditionCommand with { PhotoGalleryUrl = "not-a-url" };
        var result = _updateEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.PhotoGalleryUrl);
    }

    [Fact]
    public void UpdateEdition_ValidPhotoGalleryUrl_Passes()
    {
        var cmd = ValidUpdateEditionCommand with { PhotoGalleryUrl = "https://sportmyndir.is/album/60" };
        var result = _updateEditionValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.PhotoGalleryUrl);
    }

    [Fact]
    public void UpdateEdition_InvalidResultsUrl_Fails()
    {
        var cmd = ValidUpdateEditionCommand with { ResultsUrl = "bad-url" };
        var result = _updateEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.ResultsUrl);
    }

    [Fact]
    public void UpdateEdition_EndDateBeforeDate_Fails()
    {
        var cmd = ValidUpdateEditionCommand with { Date = new DateOnly(2025, 8, 3), EndDate = new DateOnly(2025, 8, 1) };
        var result = _updateEditionValidator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void UpdateEdition_EndDateAfterDate_Passes()
    {
        var cmd = ValidUpdateEditionCommand with { Date = new DateOnly(2025, 8, 1), EndDate = new DateOnly(2025, 8, 3) };
        var result = _updateEditionValidator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.EndDate);
    }

    // ─── CreateRaceCommandValidator ───
    private CreateRaceCommandValidator RaceValidator() => new(_factory.CreateContext());

    private static readonly Guid _placeholderEditionId = Guid.NewGuid();

    private static CreateRaceCommand ValidRaceCommand => BaseRaceCommand(_placeholderEditionId);

    private static CreateRaceCommand BaseRaceCommand(Guid editionId) => new(
        EventEditionId: editionId,
        TrailId: null,
        Name: "55K Ultra",
        DistanceLabel: "55 km",
        CutoffMinutes: 720,
        Description: null,
        Status: "Active",
        SortOrder: 0,
        TicketStatus: "Available",
        ResultType: "Time",
        MaxParticipants: 200,
        ItraPoints: 4,
        CertifiedBy: "ITRA",
        PrizeMoney: 1000m,
        ChampionshipCategory: null,
        DateOfRace: null,
        StartTime: null
    );

    private async Task<Guid> SeedActiveEdition(string slug)
    {
        var ev = new Event { Id = Guid.NewGuid(), Name = "Test Event", Slug = slug, Type = EventType.Race, Status = EventStatus.Confirmed };
        var edition = new EventEdition { Id = Guid.NewGuid(), EventId = ev.Id, Status = EditionStatus.Active, RegistrationStatus = RegistrationStatus.Open };
        using var ctx = _factory.CreateContext();
        ctx.Events.Add(ev);
        ctx.EventEditions.Add(edition);
        await ctx.SaveChangesAsync();
        return edition.Id;
    }

    [Fact]
    public async Task CreateRace_ValidCommand_Passes()
    {
        var editionId = await SeedActiveEdition($"test-event-vcp-{Guid.NewGuid():N}");
        var result = await RaceValidator().TestValidateAsync(BaseRaceCommand(editionId));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task CreateRace_EmptyEditionId_Fails()
    {
        var cmd = ValidRaceCommand with { EventEditionId = Guid.Empty };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EventEditionId);
    }

    [Fact]
    public async Task CreateRace_EmptyName_Fails()
    {
        var cmd = ValidRaceCommand with { Name = "" };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public async Task CreateRace_NegativeCutoff_Fails()
    {
        var cmd = ValidRaceCommand with { CutoffMinutes = -10 };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.CutoffMinutes);
    }

    [Fact]
    public async Task CreateRace_NegativeSortOrder_Fails()
    {
        var cmd = ValidRaceCommand with { SortOrder = -1 };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.SortOrder);
    }

    [Fact]
    public async Task CreateRace_ItraPointsOutOfRange_Fails()
    {
        var cmd = ValidRaceCommand with { ItraPoints = 7 };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.ItraPoints);
    }

    [Fact]
    public async Task CreateRace_NullItraPoints_Passes()
    {
        var cmd = ValidRaceCommand with { ItraPoints = null };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.ItraPoints);
    }

    [Fact]
    public async Task CreateRace_NegativePrizeMoney_Fails()
    {
        var cmd = ValidRaceCommand with { PrizeMoney = -500m };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.PrizeMoney);
    }

    [Fact]
    public async Task CreateRace_InvalidTicketStatus_Fails()
    {
        var cmd = ValidRaceCommand with { TicketStatus = "NotValid" };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.TicketStatus);
    }

    [Fact]
    public async Task CreateRace_InvalidResultType_Fails()
    {
        var cmd = ValidRaceCommand with { ResultType = "NotValid" };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.ResultType);
    }

    [Fact]
    public async Task CreateRace_ValidResultType_Distance_Passes()
    {
        var cmd = ValidRaceCommand with { ResultType = "Distance" };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.ResultType);
    }

    [Fact]
    public async Task CreateRace_UnderCancelledEdition_Fails()
    {
        var ev = new Event { Id = Guid.NewGuid(), Name = "Test Event", Slug = "test-event-car", Type = EventType.Race, Status = EventStatus.Confirmed };
        var edition = new EventEdition { Id = Guid.NewGuid(), EventId = ev.Id, Status = EditionStatus.Cancelled, RegistrationStatus = RegistrationStatus.Closed };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        var cmd = ValidRaceCommand with { EventEditionId = edition.Id };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EventEditionId);
    }

    [Fact]
    public async Task CreateRace_NonExistentEdition_Fails()
    {
        // FirstOrDefaultAsync on a missing row returned default(EditionStatus) = Active (0),
        // so the guard silently passed and the handler would have inserted a race with an invalid FK.
        var cmd = ValidRaceCommand with { EventEditionId = Guid.NewGuid() };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.EventEditionId);
    }

    [Fact]
    public async Task CreateRace_UnderActiveEdition_Passes()
    {
        var ev = new Event { Id = Guid.NewGuid(), Name = "Test Event", Slug = "test-event-rae", Type = EventType.Race, Status = EventStatus.Confirmed };
        var edition = new EventEdition { Id = Guid.NewGuid(), EventId = ev.Id, Status = EditionStatus.Active, RegistrationStatus = RegistrationStatus.Open };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        var cmd = ValidRaceCommand with { EventEditionId = edition.Id };
        var result = await RaceValidator().TestValidateAsync(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.EventEditionId);
    }

    // ─── UpdateRaceCommandValidator ───

    private UpdateRaceCommandValidator UpdateRaceValidator() => new(_factory.CreateContext());

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
        ResultType: "Time",
        MaxParticipants: 100,
        ItraPoints: 2,
        CertifiedBy: null,
        PrizeMoney: 0,
        ChampionshipCategory: null,
        DateOfRace: null,
        StartTime: null
    );

    [Fact]
    public async Task UpdateRace_ValidCommand_Passes()
    {
        var result = await UpdateRaceValidator().TestValidateAsync(ValidUpdateRaceCommand);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task UpdateRace_EmptyId_Fails()
    {
        var cmd = ValidUpdateRaceCommand with { Id = Guid.Empty };
        var result = await UpdateRaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public async Task UpdateRace_InvalidResultType_Fails()
    {
        var cmd = ValidUpdateRaceCommand with { ResultType = "NotValid" };
        var result = await UpdateRaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.ResultType);
    }

    [Fact]
    public async Task UpdateRace_ValidResultType_Laps_Passes()
    {
        var cmd = ValidUpdateRaceCommand with { ResultType = "Laps" };
        var result = await UpdateRaceValidator().TestValidateAsync(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.ResultType);
    }

    [Fact]
    public async Task UpdateRace_NullItraPoints_Passes()
    {
        var cmd = ValidUpdateRaceCommand with { ItraPoints = null };
        var result = await UpdateRaceValidator().TestValidateAsync(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.ItraPoints);
    }

    private async Task<(Event ev, EventEdition edition, Race race)> SeedRaceUnderEdition(EditionStatus editionStatus, RaceStatus raceStatus, string slugSuffix)
    {
        var ev = new Event { Id = Guid.NewGuid(), Name = "Test Event", Slug = $"test-event-{slugSuffix}", Type = EventType.Race, Status = EventStatus.Confirmed };
        var edition = new EventEdition { Id = Guid.NewGuid(), EventId = ev.Id, Status = editionStatus, RegistrationStatus = RegistrationStatus.Closed };
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "Test Race", SortOrder = 0, Status = raceStatus, TicketStatus = TicketStatus.Closed };
        using var ctx = _factory.CreateContext();
        ctx.Events.Add(ev);
        ctx.EventEditions.Add(edition);
        ctx.Races.Add(race);
        await ctx.SaveChangesAsync();
        return (ev, edition, race);
    }

    [Fact]
    public async Task UpdateRace_LeavingCancelled_WhileEditionCancelled_Fails()
    {
        var (_, _, race) = await SeedRaceUnderEdition(EditionStatus.Cancelled, RaceStatus.Cancelled, "urwlwec");

        var cmd = ValidUpdateRaceCommand with { Id = race.Id, Status = "Active" };
        var result = await UpdateRaceValidator().TestValidateAsync(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public async Task UpdateRace_StayingCancelled_WhileEditionCancelled_Passes()
    {
        var (_, _, race) = await SeedRaceUnderEdition(EditionStatus.Cancelled, RaceStatus.Cancelled, "ursclec");

        var cmd = ValidUpdateRaceCommand with { Id = race.Id, Status = "Cancelled" };
        var result = await UpdateRaceValidator().TestValidateAsync(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public async Task UpdateRace_ChangingStatus_WhileEditionActive_Passes()
    {
        var (_, _, race) = await SeedRaceUnderEdition(EditionStatus.Active, RaceStatus.Active, "urcswea");

        var cmd = ValidUpdateRaceCommand with { Id = race.Id, Status = "Completed" };
        var result = await UpdateRaceValidator().TestValidateAsync(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
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

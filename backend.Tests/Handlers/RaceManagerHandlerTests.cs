using Utanvega.Backend.Application.Events.Commands.PatchEventStatus;
using Utanvega.Backend.Application.Events.Queries.GetRaceDayEditions;
using Utanvega.Backend.Application.Events.Queries.GetNextRaceDay;
using Utanvega.Backend.Application.Events.Queries.GetPrevRaceDay;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class RaceManagerHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public RaceManagerHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private async Task<(Event ev, EventEdition edition)> SeedEdition(
        DateOnly date, DateOnly? endDate = null, EventStatus status = EventStatus.Confirmed)
    {
        using var db = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Test Race",
            Slug = $"test-race-{Guid.NewGuid():N}",
            Type = EventType.Race,
            Status = status,
        };
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Date = date,
            EndDate = endDate,
            RegistrationStatus = RegistrationStatus.Open,
        };
        db.Events.Add(ev);
        db.EventEditions.Add(edition);
        await db.SaveChangesAsync();
        return (ev, edition);
    }

    // ── PatchEventStatus ──────────────────────────────────────────────────────

    [Fact]
    public async Task PatchEventStatus_UpdatesStatus_ForKnownEvent()
    {
        using var db = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "My Race",
            Slug = "my-race",
            Type = EventType.Race,
            Status = EventStatus.Confirmed,
        };
        db.Events.Add(ev);
        await db.SaveChangesAsync();

        var handler = new PatchEventStatusCommandHandler(_factory.CreateContext());
        var result = await handler.Handle(new PatchEventStatusCommand(ev.Id, "Cancelled"), CancellationToken.None);

        Assert.True(result);
        using var verify = _factory.CreateContext();
        var updated = await verify.Events.FindAsync(ev.Id);
        Assert.Equal(EventStatus.Cancelled, updated!.Status);
    }

    [Fact]
    public async Task PatchEventStatus_ReturnsFalse_ForUnknownEvent()
    {
        var handler = new PatchEventStatusCommandHandler(_factory.CreateContext());

        var result = await handler.Handle(new PatchEventStatusCommand(Guid.NewGuid(), "Confirmed"), CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task PatchEventStatus_ReturnsFalse_ForInvalidStatus()
    {
        using var db = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "My Race",
            Slug = "my-race-2",
            Type = EventType.Race,
            Status = EventStatus.Confirmed,
        };
        db.Events.Add(ev);
        await db.SaveChangesAsync();

        var handler = new PatchEventStatusCommandHandler(_factory.CreateContext());
        var result = await handler.Handle(new PatchEventStatusCommand(ev.Id, "NotAStatus"), CancellationToken.None);

        Assert.False(result);
        // status should be unchanged
        using var verify = _factory.CreateContext();
        Assert.Equal(EventStatus.Confirmed, (await verify.Events.FindAsync(ev.Id))!.Status);
    }

    [Fact]
    public async Task PatchEventStatus_AcceptsCaseInsensitiveStatus()
    {
        // Regression: ignoreCase was missing, so "confirmed" silently returned false
        // even though the event existed.
        using var db = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "My Race",
            Slug = $"my-race-ci-{Guid.NewGuid():N}",
            Type = EventType.Race,
            Status = EventStatus.Unconfirmed,
        };
        db.Events.Add(ev);
        await db.SaveChangesAsync();

        var handler = new PatchEventStatusCommandHandler(_factory.CreateContext());
        var result = await handler.Handle(new PatchEventStatusCommand(ev.Id, "confirmed"), CancellationToken.None);

        Assert.True(result);
        using var verify = _factory.CreateContext();
        Assert.Equal(EventStatus.Confirmed, (await verify.Events.FindAsync(ev.Id))!.Status);
    }

    [Fact]
    public async Task PatchEventStatus_CancellingEvent_CascadesToFutureEdition()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var (ev, edition) = await SeedEdition(today.AddDays(30));
        using (var db = _factory.CreateContext())
        {
            var found = await db.EventEditions.FindAsync(edition.Id);
            found!.Status = EditionStatus.Active;
            await db.SaveChangesAsync();
        }

        var handler = new PatchEventStatusCommandHandler(_factory.CreateContext());
        var result = await handler.Handle(new PatchEventStatusCommand(ev.Id, "Cancelled"), CancellationToken.None);

        Assert.True(result);
        using var verify = _factory.CreateContext();
        Assert.Equal(EventStatus.Cancelled, (await verify.Events.FindAsync(ev.Id))!.Status);
        Assert.Equal(EditionStatus.Cancelled, (await verify.EventEditions.FindAsync(edition.Id))!.Status);
    }

    [Fact]
    public async Task PatchEventStatus_CancellingEvent_LeavesPastDatedEditionUntouched()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var (ev, edition) = await SeedEdition(today.AddDays(-30));
        using (var db = _factory.CreateContext())
        {
            var found = await db.EventEditions.FindAsync(edition.Id);
            found!.Status = EditionStatus.Active;
            await db.SaveChangesAsync();
        }

        var handler = new PatchEventStatusCommandHandler(_factory.CreateContext());
        await handler.Handle(new PatchEventStatusCommand(ev.Id, "Cancelled"), CancellationToken.None);

        using var verify = _factory.CreateContext();
        Assert.Equal(EditionStatus.Active, (await verify.EventEditions.FindAsync(edition.Id))!.Status);
    }

    [Fact]
    public async Task PatchEventStatus_ReactivatingCancelledEvent_DoesNotCascadeToEditions()
    {
        // Reactivation must not be treated symmetrically with cancellation: an edition that was
        // separately cancelled while the event was cancelled stays cancelled — moving the event
        // back to Confirmed doesn't imply the editions/races should un-cancel too.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var (ev, edition) = await SeedEdition(today.AddDays(30), status: EventStatus.Cancelled);
        using (var db = _factory.CreateContext())
        {
            var found = await db.EventEditions.FindAsync(edition.Id);
            found!.Status = EditionStatus.Cancelled;
            await db.SaveChangesAsync();
        }

        var handler = new PatchEventStatusCommandHandler(_factory.CreateContext());
        var result = await handler.Handle(new PatchEventStatusCommand(ev.Id, "Confirmed"), CancellationToken.None);

        Assert.True(result);
        using var verify = _factory.CreateContext();
        Assert.Equal(EventStatus.Confirmed, (await verify.Events.FindAsync(ev.Id))!.Status);
        Assert.Equal(EditionStatus.Cancelled, (await verify.EventEditions.FindAsync(edition.Id))!.Status);
    }

    // ── GetRaceDayEditions ────────────────────────────────────────────────────

    [Fact]
    public async Task GetRaceDayEditions_ReturnsEditions_OnExactDate()
    {
        var date = new DateOnly(2026, 8, 15);
        await SeedEdition(date);

        var handler = new GetRaceDayEditionsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetRaceDayEditionsQuery(date), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(date, result[0].Date);
    }

    [Fact]
    public async Task GetRaceDayEditions_ReturnsEdition_WhenDateFallsWithinMultiDayEvent()
    {
        var start = new DateOnly(2026, 8, 14);
        var end   = new DateOnly(2026, 8, 16);
        await SeedEdition(start, endDate: end);

        var handler = new GetRaceDayEditionsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetRaceDayEditionsQuery(new DateOnly(2026, 8, 15)), CancellationToken.None);

        Assert.Single(result);
    }

    [Fact]
    public async Task GetRaceDayEditions_ReturnsEmpty_WhenNoEditionsOnDate()
    {
        var date = new DateOnly(2026, 9, 1);
        await SeedEdition(new DateOnly(2026, 8, 15)); // different date

        var handler = new GetRaceDayEditionsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetRaceDayEditionsQuery(date), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRaceDayEditions_ExcludesHiddenEvents()
    {
        var date = new DateOnly(2026, 8, 20);
        await SeedEdition(date, status: EventStatus.Hidden);

        var handler = new GetRaceDayEditionsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetRaceDayEditionsQuery(date), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRaceDayEditions_IncludesRaces_InResponse()
    {
        var date = new DateOnly(2026, 8, 22);
        var (_, edition) = await SeedEdition(date);

        using var db = _factory.CreateContext();
        db.Races.AddRange(
            new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K",  SortOrder = 1, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available },
            new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "Half", SortOrder = 2, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available }
        );
        await db.SaveChangesAsync();

        var handler = new GetRaceDayEditionsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetRaceDayEditionsQuery(date), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(2, result[0].Races.Count);
        Assert.Equal("10K",  result[0].Races[0].Name);
        Assert.Equal("Half", result[0].Races[1].Name);
    }

    // ── GetNextRaceDay / GetPrevRaceDay ───────────────────────────────────────

    [Fact]
    public async Task GetNextRaceDay_ReturnsNextDate_AfterGiven()
    {
        await SeedEdition(new DateOnly(2026, 8, 10));
        await SeedEdition(new DateOnly(2026, 8, 20));

        var handler = new GetNextRaceDayQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetNextRaceDayQuery(new DateOnly(2026, 8, 10)), CancellationToken.None);

        Assert.Equal(new DateOnly(2026, 8, 20), result);
    }

    [Fact]
    public async Task GetNextRaceDay_ReturnsNull_WhenNoFutureEditions()
    {
        await SeedEdition(new DateOnly(2026, 8, 1));

        var handler = new GetNextRaceDayQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetNextRaceDayQuery(new DateOnly(2026, 8, 1)), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetNextRaceDay_IgnoresHiddenEvents()
    {
        await SeedEdition(new DateOnly(2026, 8, 15), status: EventStatus.Hidden);
        await SeedEdition(new DateOnly(2026, 8, 25)); // visible

        var handler = new GetNextRaceDayQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetNextRaceDayQuery(new DateOnly(2026, 8, 10)), CancellationToken.None);

        Assert.Equal(new DateOnly(2026, 8, 25), result);
    }
}

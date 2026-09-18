using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Retention;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// Individual races under a still-Active edition (typically a multi-leg Series) must complete as
/// their own DateOfRace passes, independent of whether the whole edition has completed yet —
/// see issue #911.
/// </summary>
public class RaceCompletionSweepTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();
    private readonly Mock<ICacheInvalidator> _cacheInvalidator = new();
    private static readonly DateOnly Today = new(2026, 9, 17);

    public void Dispose() => _factory.Dispose();

    private Event CreateEvent(string name = "Test Event", EventType type = EventType.Race)
    {
        return new Event
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Type = type,
            Status = EventStatus.Confirmed,
        };
    }

    private static EventEdition CreateEdition(Guid eventId, EditionStatus status, DateOnly? date)
    {
        return new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Status = status,
            Date = date,
        };
    }

    private static Race CreateRace(
        Guid editionId,
        string name,
        RaceStatus status,
        TicketStatus ticketStatus,
        DateOnly? dateOfRace)
    {
        return new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = editionId,
            Name = name,
            Status = status,
            TicketStatus = ticketStatus,
            DateOfRace = dateOfRace,
        };
    }

    [Fact]
    public async Task CompletesAPastDatedActiveRaceUnderAnActiveEdition()
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-30));
        var race = CreateRace(edition.Id, "10K", RaceStatus.Active, TicketStatus.Available, Today.AddDays(-1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(1, completed);

        using var verifyCtx = _factory.CreateContext();
        var updated = verifyCtx.Races.Find(race.Id)!;
        Assert.Equal(RaceStatus.Completed, updated.Status);
        Assert.Equal(TicketStatus.Closed, updated.TicketStatus);
        Assert.Equal(EditionStatus.Active, verifyCtx.EventEditions.Find(edition.Id)!.Status);

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev.Slug), Times.Once);
    }

    [Fact]
    public async Task InASixLegSeriesOnlyThePastLegCompletesWhileEditionStaysActive()
    {
        // A 6-leg winter series (Oct-Mar): only the October leg has passed. The other 5 legs and
        // the parent edition itself must stay Active — this sweep must never touch anything but
        // the one past-dated race.
        var ev = CreateEvent(type: EventType.Series);
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-60));
        var pastLeg = CreateRace(edition.Id, "October", RaceStatus.Active, TicketStatus.Available, Today.AddDays(-1));
        var futureLegs = new[]
        {
            CreateRace(edition.Id, "November", RaceStatus.Active, TicketStatus.Available, Today.AddDays(30)),
            CreateRace(edition.Id, "December", RaceStatus.Active, TicketStatus.Available, Today.AddDays(60)),
            CreateRace(edition.Id, "January", RaceStatus.Active, TicketStatus.Available, Today.AddDays(90)),
            CreateRace(edition.Id, "February", RaceStatus.Active, TicketStatus.Available, Today.AddDays(120)),
            CreateRace(edition.Id, "March", RaceStatus.Active, TicketStatus.Available, Today.AddDays(150)),
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(pastLeg);
            ctx.Races.AddRange(futureLegs);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(1, completed);

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(RaceStatus.Completed, verifyCtx.Races.Find(pastLeg.Id)!.Status);
        Assert.Equal(TicketStatus.Closed, verifyCtx.Races.Find(pastLeg.Id)!.TicketStatus);
        foreach (var leg in futureLegs)
        {
            Assert.Equal(RaceStatus.Active, verifyCtx.Races.Find(leg.Id)!.Status);
            Assert.Equal(TicketStatus.Available, verifyCtx.Races.Find(leg.Id)!.TicketStatus);
        }
        Assert.Equal(EditionStatus.Active, verifyCtx.EventEditions.Find(edition.Id)!.Status);

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev.Slug), Times.Once);
    }

    [Fact]
    public async Task LeavesADatelessRaceUntouched()
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-30));
        var race = CreateRace(edition.Id, "Fun Run", RaceStatus.Active, TicketStatus.Available, dateOfRace: null);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);

        using var verifyCtx = _factory.CreateContext();
        var untouched = verifyCtx.Races.Find(race.Id)!;
        Assert.Equal(RaceStatus.Active, untouched.Status);
        Assert.Equal(TicketStatus.Available, untouched.TicketStatus);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData(EditionStatus.Unconfirmed)]
    [InlineData(EditionStatus.Hidden)]
    public async Task LeavesARaceUnderANonActiveEditionUntouchedEvenIfItsOwnDateHasPassed(EditionStatus editionStatus)
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, editionStatus, Today.AddDays(-30));
        var race = CreateRace(edition.Id, "10K", RaceStatus.Active, TicketStatus.Available, Today.AddDays(-1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);

        using var verifyCtx = _factory.CreateContext();
        var untouched = verifyCtx.Races.Find(race.Id)!;
        Assert.Equal(RaceStatus.Active, untouched.Status);
        Assert.Equal(TicketStatus.Available, untouched.TicketStatus);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData(RaceStatus.Completed, TicketStatus.Closed)]
    [InlineData(RaceStatus.Cancelled, TicketStatus.Closed)]
    public async Task LeavesAnAlreadyTerminalRaceUntouched(RaceStatus status, TicketStatus ticketStatus)
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-30));
        var race = CreateRace(edition.Id, "10K", status, ticketStatus, Today.AddDays(-1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task LeavesAFutureDatedActiveRaceUntouched()
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-30));
        var race = CreateRace(edition.Id, "10K", RaceStatus.Active, TicketStatus.Available, Today.AddDays(5));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task InvalidatesCacheOncePerDistinctEventNotOncePerRace()
    {
        // A Series event can have several overdue Active races (across one or more editions) in a
        // single sweep. InvalidateEvent also bumps the shared EventVersion token, so calling it
        // once per race here would bump that token redundantly for the same event. See #909.
        var ev = CreateEvent(type: EventType.Series);
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-60));
        var race1 = CreateRace(edition.Id, "October", RaceStatus.Active, TicketStatus.Available, Today.AddDays(-30));
        var race2 = CreateRace(edition.Id, "November", RaceStatus.Active, TicketStatus.Available, Today.AddDays(-1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(race1, race2);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(2, completed);

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev.Slug), Times.Once);
    }

    [Fact]
    public async Task DoesNotDoubleProcessOrThrowWhenEditionCompletionSweepRunsAfterwards()
    {
        // Once the last leg of a Series edition passes, EditionCompletionSweep runs
        // CompleteWithRaces() against a mix of races this sweep already completed and any
        // still-Active ones — must not double-process or throw.
        var ev = CreateEvent(type: EventType.Series);
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-60));
        var pastLeg = CreateRace(edition.Id, "October", RaceStatus.Active, TicketStatus.Available, Today.AddDays(-30));
        var lastLeg = CreateRace(edition.Id, "March", RaceStatus.Active, TicketStatus.Available, Today.AddDays(-1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(pastLeg, lastLeg);
            await ctx.SaveChangesAsync();
        }

        // First: this sweep completes both past-dated legs.
        using (var ctx = _factory.CreateContext())
        {
            var completed = await RaceCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
            Assert.Equal(2, completed);
        }

        // Then: the edition-level sweep runs on the same, now-past-dated edition. It must
        // complete the edition without throwing, even though its races are already Completed.
        using (var ctx = _factory.CreateContext())
        {
            var editionCompleted = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
            Assert.Equal(1, editionCompleted);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(EditionStatus.Completed, verifyCtx.EventEditions.Find(edition.Id)!.Status);
        Assert.Equal(RaceStatus.Completed, verifyCtx.Races.Find(pastLeg.Id)!.Status);
        Assert.Equal(RaceStatus.Completed, verifyCtx.Races.Find(lastLeg.Id)!.Status);
    }
}

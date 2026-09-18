using Microsoft.EntityFrameworkCore;
using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Retention;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// The completion sweep must reach exactly the same end state
/// CompleteEditionCommandHandler produces for a manual click — see issue #361 — because it calls
/// EventEdition.CompleteWithRaces() itself rather than reimplementing the transition.
/// </summary>
public class EditionCompletionSweepTests : IDisposable
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

    private static EventEdition CreateEdition(
        Guid eventId,
        EditionStatus status,
        DateOnly? date,
        DateOnly? endDate = null,
        RegistrationStatus registrationStatus = RegistrationStatus.Open)
    {
        return new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Status = status,
            Date = date,
            EndDate = endDate,
            RegistrationStatus = registrationStatus,
        };
    }

    [Fact]
    public async Task CompletesAnActiveEditionWhosePastEndDate()
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-10));
        var activeRace = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(activeRace);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(1, completed);

        using var verifyCtx = _factory.CreateContext();
        var updated = verifyCtx.EventEditions.Find(edition.Id)!;
        Assert.Equal(EditionStatus.Completed, updated.Status);
        Assert.Equal(RegistrationStatus.Closed, updated.RegistrationStatus);
        Assert.Equal(RaceStatus.Completed, verifyCtx.Races.Find(activeRace.Id)!.Status);
        Assert.Equal(TicketStatus.Closed, verifyCtx.Races.Find(activeRace.Id)!.TicketStatus);

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev.Slug), Times.Once);
    }

    [Fact]
    public async Task LeavesAMultiDayEditionAloneWhileEndDateIsStillInTheFuture()
    {
        // Date (start) is past but EndDate hasn't happened yet — the run is still ongoing.
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-1), Today.AddDays(1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(EditionStatus.Active, verifyCtx.EventEditions.Find(edition.Id)!.Status);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData(EditionStatus.Unconfirmed)]
    [InlineData(EditionStatus.Hidden)]
    [InlineData(EditionStatus.Completed)]
    [InlineData(EditionStatus.Cancelled)]
    public async Task LeavesNonActivePastEditionsUntouched(EditionStatus status)
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, status, Today.AddDays(-30));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(status, verifyCtx.EventEditions.Find(edition.Id)!.Status);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task LeavesAFutureActiveEditionUntouched()
    {
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(5));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);
    }

    [Fact]
    public async Task PreservesNotRequiredRegistrationStatus()
    {
        // CompleteWithRaces() leaves NotRequired alone rather than forcing it to Closed —
        // confirm the sweep goes through that method rather than a hand-rolled transition.
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-1), registrationStatus: RegistrationStatus.NotRequired);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }

        using var verifyCtx = _factory.CreateContext();
        var updated = verifyCtx.EventEditions.Find(edition.Id)!;
        Assert.Equal(EditionStatus.Completed, updated.Status);
        Assert.Equal(RegistrationStatus.NotRequired, updated.RegistrationStatus);
    }

    [Fact]
    public async Task LeavesASeriesEditionAloneWhileALaterLegIsStillInTheFuture()
    {
        // Series editions typically have Date = first leg's date and no EndDate (see
        // GenerateEditionsForSeasonCommand), so EffectiveDate alone would resolve to the first
        // leg and mark the whole edition — and every still-unrun later leg — Completed the moment
        // that first leg passes. The sweep must instead look at the latest race's DateOfRace.
        var ev = CreateEvent(type: EventType.Series);
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-10));
        var pastLeg = new Race
        {
            Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "Leg 1",
            Status = RaceStatus.Completed, TicketStatus = TicketStatus.Closed,
            DateOfRace = Today.AddDays(-10),
        };
        var futureLeg = new Race
        {
            Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "Leg 2",
            Status = RaceStatus.Active, TicketStatus = TicketStatus.Available,
            DateOfRace = Today.AddDays(10),
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(pastLeg, futureLeg);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, completed);

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(EditionStatus.Active, verifyCtx.EventEditions.Find(edition.Id)!.Status);
        Assert.Equal(RaceStatus.Completed, verifyCtx.Races.Find(pastLeg.Id)!.Status);
        Assert.Equal(RaceStatus.Active, verifyCtx.Races.Find(futureLeg.Id)!.Status);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task InvalidatesCacheOncePerEventNotOncePerEdition()
    {
        // A Series event can have several overdue Active editions in a single sweep run.
        // InvalidateEvent also bumps the shared EventVersion token, so calling it once per
        // edition here would bump that token redundantly for the same event — see issue #909.
        var ev = CreateEvent(type: EventType.Series);
        var edition1 = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-10));
        var edition2 = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-5));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.AddRange(edition1, edition2);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(2, completed);

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev.Slug), Times.Once);
    }

    [Fact]
    public async Task InvalidatesCacheOncePerDistinctEventAcrossMultipleEvents()
    {
        // Regression guard: deduping by slug must not collapse invalidations across different
        // events — each distinct event still gets its own call.
        var ev1 = CreateEvent(name: "Event One");
        var ev2 = CreateEvent(name: "Event Two");
        var edition1 = CreateEdition(ev1.Id, EditionStatus.Active, Today.AddDays(-10));
        var edition2 = CreateEdition(ev2.Id, EditionStatus.Active, Today.AddDays(-5));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.AddRange(ev1, ev2);
            ctx.EventEditions.AddRange(edition1, edition2);
            await ctx.SaveChangesAsync();
        }

        int completed;
        using (var ctx = _factory.CreateContext())
        {
            completed = await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(2, completed);

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev1.Slug), Times.Once);
        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev2.Slug), Times.Once);
    }

    [Fact]
    public async Task IsIdempotent()
    {
        // The sweep runs on a timer with no coordination, so a second run must be a no-op
        // rather than erroring or double-invalidating the cache.
        var ev = CreateEvent();
        var edition = CreateEdition(ev.Id, EditionStatus.Active, Today.AddDays(-1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Equal(1, await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today));
        }
        using (var ctx = _factory.CreateContext())
        {
            Assert.Equal(0, await EditionCompletionSweep.RunAsync(ctx, _cacheInvalidator.Object, Today));
        }

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev.Slug), Times.Once);
    }
}

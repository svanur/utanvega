using Microsoft.EntityFrameworkCore;
using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Retention;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// The auto-clone sweep must reproduce handleCloneEdition's exact behaviour (admin's manual
/// "Clone edition to next year" button in EventDetailPage) so the automatic and manual paths never
/// drift apart — see issue #904.
/// </summary>
public class EditionAutoCloneSweepTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();
    private readonly Mock<ICacheInvalidator> _cacheInvalidator = new();
    private static readonly DateOnly Today = new(2026, 9, 17);

    public void Dispose() => _factory.Dispose();

    private Event CreateEvent(
        string name = "Test Race",
        EventType type = EventType.Race,
        EventStatus status = EventStatus.Confirmed)
    {
        return new Event
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Type = type,
            Status = status,
        };
    }

    private static EventEdition CreateCompletedEdition(
        Guid eventId,
        int? year,
        DateOnly? date,
        DateOnly? endDate = null,
        string? registrationUrl = null,
        string? resultsUrl = null,
        string? title = null,
        Guid? trailId = null)
    {
        return new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Status = EditionStatus.Completed,
            RegistrationStatus = RegistrationStatus.Closed,
            Year = year,
            Date = date,
            EndDate = endDate,
            RegistrationUrl = registrationUrl,
            ResultsUrl = resultsUrl,
            Title = title,
            Notes = "some old notes",
            NotesEn = "some old notes en",
            TrailId = trailId,
        };
    }

    [Fact]
    public async Task ClonesANextYearEditionForACompletedRaceEdition()
    {
        var ev = CreateEvent(type: EventType.Race);
        // 2026-08-15 is a Saturday.
        var edition = CreateCompletedEdition(ev.Id, 2026, new DateOnly(2026, 8, 15));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        int cloned;
        using (var ctx = _factory.CreateContext())
        {
            cloned = await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(1, cloned);

        using var verifyCtx = _factory.CreateContext();
        var newEdition = verifyCtx.EventEditions.Single(e => e.Year == 2027);
        Assert.Equal(ev.Id, newEdition.EventId);
        Assert.NotEqual(edition.Id, newEdition.Id);
    }

    [Fact]
    public async Task ClonesANextYearEditionForACompletedSeriesEdition()
    {
        var ev = CreateEvent(type: EventType.Series);
        var edition = CreateCompletedEdition(ev.Id, 2026, new DateOnly(2026, 5, 2));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        int cloned;
        using (var ctx = _factory.CreateContext())
        {
            cloned = await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(1, cloned);

        using var verifyCtx = _factory.CreateContext();
        Assert.True(verifyCtx.EventEditions.Any(e => e.Year == 2027 && e.EventId == ev.Id));
    }

    [Theory]
    [InlineData(EventStatus.Cancelled)]
    [InlineData(EventStatus.Hidden)]
    [InlineData(EventStatus.Unconfirmed)]
    [InlineData(EventStatus.Unlisted)]
    public async Task DoesNotCloneWhenParentEventIsNotConfirmed(EventStatus eventStatus)
    {
        var ev = CreateEvent(status: eventStatus);
        var edition = CreateCompletedEdition(ev.Id, 2026, new DateOnly(2026, 8, 15));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        int cloned;
        using (var ctx = _factory.CreateContext())
        {
            cloned = await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, cloned);

        using var verifyCtx = _factory.CreateContext();
        Assert.False(verifyCtx.EventEditions.Any(e => e.Year == 2027));
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DoesNotCreateADuplicateWhenANextYearEditionAlreadyExists()
    {
        var ev = CreateEvent();
        var edition = CreateCompletedEdition(ev.Id, 2026, new DateOnly(2026, 8, 15));
        var existingNextYear = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = 2027,
            Status = EditionStatus.Unconfirmed,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.AddRange(edition, existingNextYear);
            await ctx.SaveChangesAsync();
        }

        int cloned;
        using (var ctx = _factory.CreateContext())
        {
            cloned = await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(0, cloned);

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(1, verifyCtx.EventEditions.Count(e => e.Year == 2027));
        _cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SuccessPathProducesAnUnconfirmedEditionWithDerivedFieldsAndClonedRaces()
    {
        var ev = CreateEvent();
        var trail = new Trail { Id = Guid.NewGuid(), Name = "Test Trail", Slug = "test-trail" };
        // 2026-08-15 (Sat) .. 2026-08-16 (Sun): a 1-day-long multi-day edition.
        var edition = CreateCompletedEdition(
            ev.Id, 2026, new DateOnly(2026, 8, 15), new DateOnly(2026, 8, 16),
            registrationUrl: "https://example.com/register-2026",
            resultsUrl: "https://example.com/results-2026",
            title: "2026",
            trailId: trail.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "10K",
            NameEn = "10K",
            DistanceLabel = "10 km",
            Status = RaceStatus.Completed,
            TicketStatus = TicketStatus.Closed,
            SortOrder = 0,
            ResultType = ResultType.Time,
            PrizeMoney = 0,
            // One day after the edition's own Date — offset must be preserved on the clone.
            DateOfRace = new DateOnly(2026, 8, 16),
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.Trails.Add(trail);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }

        using var verifyCtx = _factory.CreateContext();
        var newEdition = verifyCtx.EventEditions
            .Include(e => e.Races)
            .Single(e => e.Year == 2027);

        Assert.Equal(EditionStatus.Unconfirmed, newEdition.Status);
        Assert.Equal(RegistrationStatus.NotStarted, newEdition.RegistrationStatus);
        Assert.False(newEdition.NeedsReview);
        Assert.NotNull(newEdition.Date);
        Assert.Equal(2027, newEdition.Date!.Value.Year);
        Assert.NotNull(newEdition.EndDate);
        // Duration (Date -> EndDate) must be preserved: 1 day.
        Assert.Equal(1, newEdition.EndDate!.Value.DayNumber - newEdition.Date!.Value.DayNumber);
        Assert.Equal("https://example.com/register-2027", newEdition.RegistrationUrl);
        Assert.Equal("https://example.com/results-2027", newEdition.ResultsUrl);
        Assert.Null(newEdition.Notes);
        Assert.Null(newEdition.NotesEn);
        Assert.Equal(trail.Id, newEdition.TrailId);

        var newRace = Assert.Single(newEdition.Races);
        Assert.Equal("10K", newRace.Name);
        Assert.Equal(RaceStatus.Active, newRace.Status);
        Assert.Equal(TicketStatus.Available, newRace.TicketStatus);
        Assert.NotNull(newRace.DateOfRace);
        // Offset from the edition's own Date (1 day) must be preserved on the clone.
        Assert.Equal(1, newRace.DateOfRace!.Value.DayNumber - newEdition.Date!.Value.DayNumber);

        _cacheInvalidator.Verify(c => c.InvalidateEvent(ev.Slug), Times.Once);
    }

    [Fact]
    public async Task FailurePathStillClonesRacesButHidesAndFlagsTheEditionWhenNoDateCanBeProjected()
    {
        var ev = CreateEvent();
        // No Date at all on the source edition — nothing to project forward from.
        var edition = CreateCompletedEdition(ev.Id, 2026, date: null);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "5K",
            Status = RaceStatus.Completed,
            TicketStatus = TicketStatus.Closed,
            SortOrder = 0,
            ResultType = ResultType.Time,
            PrizeMoney = 0,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }

        using var verifyCtx = _factory.CreateContext();
        var newEdition = verifyCtx.EventEditions
            .Include(e => e.Races)
            .Single(e => e.Year == 2027);

        Assert.Equal(EditionStatus.Hidden, newEdition.Status);
        Assert.True(newEdition.NeedsReview);
        Assert.Null(newEdition.Date);
        var newRace = Assert.Single(newEdition.Races);
        Assert.Equal("5K", newRace.Name);
        Assert.Equal(RaceStatus.Active, newRace.Status);
    }

    [Fact]
    public async Task PicksUpAManuallyCompletedEditionJustAsReadilyAsAnAutomaticallyCompletedOne()
    {
        // Eligibility must be recomputed fresh from current DB state on every run, not tied to
        // whatever the completion sweep itself just produced in the same pass.
        var ev = CreateEvent();
        var edition = CreateCompletedEdition(ev.Id, 2026, new DateOnly(2026, 8, 15));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        int cloned;
        using (var ctx = _factory.CreateContext())
        {
            // Run in isolation, with no prior EditionCompletionSweep.RunAsync call in this test at
            // all — the edition was already Completed by the time this sweep looked at it, exactly
            // as if a human had clicked "Mark edition Completed" by hand.
            cloned = await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }
        Assert.Equal(1, cloned);
    }

    [Fact]
    public async Task IsIdempotent()
    {
        var ev = CreateEvent();
        var edition = CreateCompletedEdition(ev.Id, 2026, new DateOnly(2026, 8, 15));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Equal(1, await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today));
        }
        using (var ctx = _factory.CreateContext())
        {
            Assert.Equal(0, await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today));
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(1, verifyCtx.EventEditions.Count(e => e.Year == 2027));
    }
}

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
        Guid? trailId = null,
        DateTime? registrationOpens = null,
        DateTime? registrationCloses = null)
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
            RegistrationOpens = registrationOpens,
            RegistrationCloses = registrationCloses,
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
            // 5 days after the edition's own Date — deliberately not the ±1 that a sign-flipped
            // offset (newDate - offset instead of newDate + offset) could still coincidentally
            // land near; +5 makes the two directions land 10 days apart, so an absolute-date
            // assertion below actually distinguishes them.
            DateOfRace = new DateOnly(2026, 8, 20),
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
        // Pinned to an exact calendar date (not just "some date in 2027" or a relative offset)
        // so a sign inversion in SuggestEditionDateForYear's ±3/±7-day wraparound rule fails
        // loudly here: source Date 2026-08-15 is a Saturday, 2027-08-15 is a Sunday (diff = 6,
        // which takes the wraparound branch), and the two possible wrap directions land on
        // 2027-08-14 (correct) vs. 2027-08-28 — 14 days apart, not adjacent, so there is no
        // shared-result blind spot between them.
        Assert.Equal(new DateOnly(2027, 8, 14), newEdition.Date);
        Assert.Equal(DayOfWeek.Saturday, newEdition.Date!.Value.DayOfWeek);
        // Duration (Date -> EndDate) of 1 day must be preserved on the new start date.
        Assert.Equal(new DateOnly(2027, 8, 15), newEdition.EndDate);
        Assert.Equal("https://example.com/register-2027", newEdition.RegistrationUrl);
        Assert.Equal("https://example.com/results-2027", newEdition.ResultsUrl);
        Assert.Null(newEdition.Notes);
        Assert.Null(newEdition.NotesEn);
        Assert.Equal(trail.Id, newEdition.TrailId);

        var newRace = Assert.Single(newEdition.Races);
        Assert.Equal("10K", newRace.Name);
        Assert.Equal(RaceStatus.Active, newRace.Status);
        Assert.Equal(TicketStatus.Available, newRace.TicketStatus);
        // The race's +5-day offset from the source edition's own Date must be preserved on top
        // of the new (2027-08-14) Date — an absolute date, not just an offset, so a sign flip in
        // ComputeClonedRaceDate (e.g. subtracting the offset instead of adding it) would land on
        // 2027-08-09 instead and fail this assertion rather than pass unnoticed.
        Assert.Equal(new DateOnly(2027, 8, 19), newRace.DateOfRace);

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

    [Fact]
    public async Task ProjectsTheRegistrationWindowForwardAndFlagsNeedsReviewWhenBothBoundsAreSet()
    {
        var ev = CreateEvent();
        // 2026-08-15 is a Saturday (same reference date as the other tests). RegistrationOpens
        // (2026-07-01, a Wednesday) and RegistrationCloses (2026-08-01, a Saturday) are both set,
        // so both must shift forward with the same weekday-preserving heuristic as Date/EndDate.
        var registrationOpens = new DateTime(2026, 7, 1, 10, 30, 0, DateTimeKind.Utc);
        var registrationCloses = new DateTime(2026, 8, 1, 23, 59, 0, DateTimeKind.Utc);
        var edition = CreateCompletedEdition(
            ev.Id, 2026, new DateOnly(2026, 8, 15),
            registrationOpens: registrationOpens,
            registrationCloses: registrationCloses);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }

        using var verifyCtx = _factory.CreateContext();
        var newEdition = verifyCtx.EventEditions.Single(e => e.Year == 2027);

        // The Date projection itself succeeds here (source has a Date), so isSuccess is true —
        // NeedsReview must still be forced true by the projected registration window, independent
        // of that success. Pinned to exact dates/times, not just "shifted somewhere", so a sign
        // flip or a dropped time-of-day fails loudly rather than passing unnoticed.
        // Kind (Utc vs Unspecified) isn't asserted here — this DbContext has no Kind-preserving
        // value converter configured for plain DateTime? columns under the SQLite test provider
        // (see TestDbContextFactory), same as every other DateTime? field in this suite; the
        // production Npgsql "timestamptz" mapping round-trips Kind correctly, which is all
        // ProjectRegistrationDateForYear's DateTime.SpecifyKind(..., value.Kind) call depends on.
        Assert.True(newEdition.NeedsReview);
        Assert.Equal(new DateTime(2027, 6, 30, 10, 30, 0), newEdition.RegistrationOpens);
        Assert.Equal(DayOfWeek.Wednesday, newEdition.RegistrationOpens!.Value.DayOfWeek);
        Assert.Equal(new DateTime(2027, 7, 31, 23, 59, 0), newEdition.RegistrationCloses);
        Assert.Equal(DayOfWeek.Saturday, newEdition.RegistrationCloses!.Value.DayOfWeek);
    }

    [Fact]
    public async Task LeavesTheRegistrationWindowNullAndDoesNotForceNeedsReviewWhenNeitherBoundIsSet()
    {
        var ev = CreateEvent();
        // No RegistrationOpens/Closes on the source at all — today's behaviour (both stay null)
        // must be unaffected by #973, and NeedsReview must not be forced true by this specific
        // change (a succeeding Date projection alone leaves NeedsReview false, same as before).
        var edition = CreateCompletedEdition(ev.Id, 2026, new DateOnly(2026, 8, 15));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }

        using var verifyCtx = _factory.CreateContext();
        var newEdition = verifyCtx.EventEditions.Single(e => e.Year == 2027);

        Assert.Null(newEdition.RegistrationOpens);
        Assert.Null(newEdition.RegistrationCloses);
        Assert.False(newEdition.NeedsReview);
    }

    [Fact]
    public async Task LeavesTheRegistrationWindowNullWhenOnlyOneBoundIsSetOnTheSource()
    {
        var ev = CreateEvent();
        // Only RegistrationOpens is set on the source — a one-sided window isn't a real window to
        // project (see #973's own guard), so both bounds must stay null on the clone exactly as
        // when neither is set, and NeedsReview must not be forced true by the registration-window
        // logic (only a succeeding/failing Date projection can affect it in this mixed case).
        var edition = CreateCompletedEdition(
            ev.Id, 2026, new DateOnly(2026, 8, 15),
            registrationOpens: new DateTime(2026, 7, 1, 10, 30, 0, DateTimeKind.Utc),
            registrationCloses: null);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }

        using var verifyCtx = _factory.CreateContext();
        var newEdition = verifyCtx.EventEditions.Single(e => e.Year == 2027);

        Assert.Null(newEdition.RegistrationOpens);
        Assert.Null(newEdition.RegistrationCloses);
        Assert.False(newEdition.NeedsReview);
    }

    [Fact]
    public async Task NeverProducesAnInvertedRegistrationWindowWhenTheSourceWindowIsNarrow()
    {
        var ev = CreateEvent();
        // A 2-day source window: RegistrationOpens (2026-07-01, Wed) and RegistrationCloses
        // (2026-07-03, Fri). Independent ±3-day weekday nudging per bound (the pre-fix behaviour)
        // can nudge Opens later and Closes earlier far enough to invert a window this narrow —
        // asserting Closes >= Opens (and the exact preserved gap) on the clone proves the fix
        // derives Closes from the newly projected Opens plus the source's original gap instead.
        var registrationOpens = new DateTime(2026, 7, 1, 10, 0, 0, DateTimeKind.Utc);
        var registrationCloses = new DateTime(2026, 7, 3, 18, 0, 0, DateTimeKind.Utc);
        var edition = CreateCompletedEdition(
            ev.Id, 2026, new DateOnly(2026, 8, 15),
            registrationOpens: registrationOpens,
            registrationCloses: registrationCloses);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            await EditionAutoCloneSweep.RunAsync(ctx, _cacheInvalidator.Object, Today);
        }

        using var verifyCtx = _factory.CreateContext();
        var newEdition = verifyCtx.EventEditions.Single(e => e.Year == 2027);

        Assert.NotNull(newEdition.RegistrationOpens);
        Assert.NotNull(newEdition.RegistrationCloses);
        Assert.True(newEdition.RegistrationCloses >= newEdition.RegistrationOpens);
        // The source's original 2-day-8-hour gap must be preserved exactly, not just "not
        // inverted" — proving Closes is derived from the newly projected Opens rather than
        // independently re-nudged from the source Closes.
        var originalGap = registrationCloses - registrationOpens;
        Assert.Equal(originalGap, newEdition.RegistrationCloses!.Value - newEdition.RegistrationOpens!.Value);
    }
}

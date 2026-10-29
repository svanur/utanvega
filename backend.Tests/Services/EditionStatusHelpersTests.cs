using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace backend.Tests.Services;

public class EditionStatusHelpersTests
{
    [Fact]
    public void ComputeEffectiveCancelled_ExplicitlyCancelled_ReturnsTrue()
    {
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(EditionStatus.Cancelled, []);
        Assert.True(result);
    }

    [Fact]
    public void ComputeEffectiveCancelled_ActiveWithNoRaces_ReturnsFalse()
    {
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(EditionStatus.Active, []);
        Assert.False(result);
    }

    [Fact]
    public void ComputeEffectiveCancelled_ActiveWithAllRacesCancelled_ReturnsTrue()
    {
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(
            EditionStatus.Active,
            [RaceStatus.Cancelled, RaceStatus.Cancelled]);
        Assert.True(result);
    }

    [Fact]
    public void ComputeEffectiveCancelled_ActiveWithMixedRaceStatuses_ReturnsFalse()
    {
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(
            EditionStatus.Active,
            [RaceStatus.Cancelled, RaceStatus.Active]);
        Assert.False(result);
    }

    [Fact]
    public void ComputeEffectiveCancelled_UnconfirmedWithAllRacesCancelled_ReturnsTrue()
    {
        // An edition can be cancelled "by race attrition" even without ever using the dedicated
        // Cancel-edition action — this is what lets the display rollup catch that case too.
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(
            EditionStatus.Unconfirmed,
            [RaceStatus.Cancelled]);
        Assert.True(result);
    }

    [Fact]
    public void ComputeEffectiveCancelled_HiddenWithActiveRaces_ReturnsFalse()
    {
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(
            EditionStatus.Hidden,
            [RaceStatus.Active]);
        Assert.False(result);
    }

    [Fact]
    public void ComputeEffectiveCancelled_Completed_ReturnsFalse()
    {
        // Completed editions ran successfully — they are not cancelled and must not be treated as such.
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(EditionStatus.Completed, []);
        Assert.False(result);
    }

    [Fact]
    public void ComputeEffectiveCancelled_CompletedWithAllRacesCancelled_ReturnsFalse()
    {
        // All-races-cancelled only implies effective cancellation for non-terminal edition statuses;
        // a Completed edition should not flip to effectively-cancelled due to race statuses.
        var result = EditionStatusHelpers.ComputeEffectiveCancelled(
            EditionStatus.Completed,
            [RaceStatus.Cancelled, RaceStatus.Cancelled]);
        Assert.False(result);
    }

    [Fact]
    public void EffectiveDate_EndDateSet_ReturnsEndDate()
    {
        var date = new DateOnly(2026, 6, 1);
        var endDate = new DateOnly(2026, 6, 3);
        var result = EditionStatusHelpers.EffectiveDate(date, endDate);
        Assert.Equal(endDate, result);
    }

    [Fact]
    public void EffectiveDate_NoEndDate_FallsBackToDate()
    {
        var date = new DateOnly(2026, 6, 1);
        var result = EditionStatusHelpers.EffectiveDate(date, null);
        Assert.Equal(date, result);
    }

    [Fact]
    public void EffectiveDate_BothNull_ReturnsNull()
    {
        var result = EditionStatusHelpers.EffectiveDate(null, null);
        Assert.Null(result);
    }

    [Fact]
    public void IsPast_DateBeforeToday_ReturnsTrue()
    {
        var today = new DateOnly(2026, 6, 5);
        var result = EditionStatusHelpers.IsPast(new DateOnly(2026, 6, 4), today);
        Assert.True(result);
    }

    [Fact]
    public void IsPast_DateEqualToToday_ReturnsFalse()
    {
        var today = new DateOnly(2026, 6, 5);
        var result = EditionStatusHelpers.IsPast(today, today);
        Assert.False(result);
    }

    [Fact]
    public void IsPast_DateAfterToday_ReturnsFalse()
    {
        var today = new DateOnly(2026, 6, 5);
        var result = EditionStatusHelpers.IsPast(new DateOnly(2026, 6, 6), today);
        Assert.False(result);
    }

    [Fact]
    public void IsPast_NullDate_ReturnsFalse()
    {
        // No date to compare — never reads as past.
        var result = EditionStatusHelpers.IsPast(null, new DateOnly(2026, 6, 5));
        Assert.False(result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_BothDatesSet_BeforeOpens_ReturnsNotStarted()
    {
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Closed, opens, closes, now);

        Assert.Equal(RegistrationStatus.NotStarted, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_BothDatesSet_WithinWindow_ReturnsOpen()
    {
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.NotStarted, opens, closes, now);

        Assert.Equal(RegistrationStatus.Open, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_BothDatesSet_AfterCloses_ReturnsClosed()
    {
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Open, opens, closes, now);

        Assert.Equal(RegistrationStatus.Closed, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_JustBeforeClosesInstant_ReturnsOpen()
    {
        // RegistrationCloses now carries real time-of-day precision — a moment just before the
        // stored instant on the closes day itself must still read as Open (#1071), not rolled
        // forward to the end of the calendar day like the old date-only fudge did.
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 9, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 3, 1, 8, 59, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Open, opens, closes, now);

        Assert.Equal(RegistrationStatus.Open, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_AtOrAfterClosesInstant_ReturnsClosed()
    {
        // Same closes day, but at/after the exact stored instant — must read Closed immediately,
        // not stay Open through the rest of the calendar day (#1071).
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 9, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 3, 1, 9, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Open, opens, closes, now);

        Assert.Equal(RegistrationStatus.Closed, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_MidnightUtcCloses_StaysOpenThroughClosesDay()
    {
        // Legacy rows (and every edition still created via EventWizardPage's date-only
        // DatePicker) store RegistrationCloses as exact midnight UTC. "Now" later the same day
        // must still read Open — the date-only fudge treats midnight as "end of that day", not
        // "start of it" (#1071 regression caught in PR #1551 review).
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 3, 1, 23, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Open, opens, closes, now);

        Assert.Equal(RegistrationStatus.Open, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_MidnightUtcCloses_ClosedTheDayAfter()
    {
        // Mirror of the test above: once the calendar day after the stored midnight-UTC date
        // has begun, the window is genuinely over.
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Open, opens, closes, now);

        Assert.Equal(RegistrationStatus.Closed, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_NeitherDateSet_ReturnsStoredStatusUnchanged()
    {
        var now = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Open, null, null, now);

        Assert.Equal(RegistrationStatus.Open, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_StoredNotRequired_ReturnsNotRequiredEvenWithBothDatesSet()
    {
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc); // would compute Open

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.NotRequired, opens, closes, now);

        Assert.Equal(RegistrationStatus.NotRequired, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_StoredInvitational_ReturnsInvitationalEvenWithBothDatesSet()
    {
        // Invitational is the same kind of override as NotRequired — entry by selection, not a
        // public registration window, e.g. the Backyard Ultra World Championship — and must not
        // be clobbered by a live computation.
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc); // would compute Open

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Invitational, opens, closes, now);

        Assert.Equal(RegistrationStatus.Invitational, result);
    }

    [Theory]
    [InlineData(EditionStatus.Cancelled)]
    [InlineData(EditionStatus.Completed)]
    public void ComputeEffectiveRegistrationStatus_TerminalEditionStatus_ReturnsStoredStatusEvenWithinOpenWindow(EditionStatus status)
    {
        // CancelWithRaces()/CompleteWithRaces() already forced RegistrationStatus to Closed as part
        // of the cascade — that stored value must win over a window that would otherwise compute Open.
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc); // would compute Open

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            status, RegistrationStatus.Closed, opens, closes, now);

        Assert.Equal(RegistrationStatus.Closed, result);
    }

    // No-offset calls below pass dateOfRace/startTime/registrationOpensMinutesBeforeRace as null
    // (the "no per-race window" default) with an arbitrary `now` — the #1553 branch never engages
    // without both dateOfRace and the offset set, so these exercise today's pre-#1553 behaviour
    // unchanged (regression guard).
    private static readonly DateTime ArbitraryNow = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionNotStarted_RaceAvailable_ReturnsNotStarted()
    {
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.NotStarted,
            null, null, null, ArbitraryNow);

        Assert.Equal(TicketStatus.NotStarted, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionOpen_ReturnsAvailable()
    {
        // Same edition as the NotStarted case above but registration has since opened — the
        // race's effective ticket status must flip on the next read with no write/sweep needed.
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Open,
            null, null, null, ArbitraryNow);

        Assert.Equal(TicketStatus.Available, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionClosed_ReturnsClosed()
    {
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Closed,
            null, null, null, ArbitraryNow);

        Assert.Equal(TicketStatus.Closed, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionNotRequired_ReturnsFree()
    {
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.NotRequired,
            null, null, null, ArbitraryNow);

        Assert.Equal(TicketStatus.Free, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionInvitational_ReturnsInvitational()
    {
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Invitational,
            null, null, null, ArbitraryNow);

        Assert.Equal(TicketStatus.Invitational, result);
    }

    [Theory]
    [InlineData(TicketStatus.SoldOut)]
    [InlineData(TicketStatus.AlmostSoldOut)]
    public void ComputeEffectiveTicketStatus_StoredSoldOutOrAlmostSoldOut_ReturnsUnchangedRegardlessOfEditionState(TicketStatus stored)
    {
        // A manual sold-out override has nothing to do with the registration window timing and
        // must not be clobbered by a live computation, even if the edition reads as freshly Open.
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, stored, RegistrationStatus.Open,
            null, null, null, ArbitraryNow);

        Assert.Equal(stored, result);
    }

    [Theory]
    [InlineData(RaceStatus.Cancelled)]
    [InlineData(RaceStatus.Completed)]
    public void ComputeEffectiveTicketStatus_RaceCancelledOrCompleted_ReturnsStoredStatusEvenWithinOpenWindow(RaceStatus raceStatus)
    {
        // CancelWithRaces()/CompleteWithRaces() already forced TicketStatus to Closed as part of
        // the cascade — that stored value must win over the edition's registration window.
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            raceStatus, TicketStatus.Closed, RegistrationStatus.Open,
            null, null, null, ArbitraryNow);

        Assert.Equal(TicketStatus.Closed, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionWithManuallySetRegistrationStatus_StillMapsCorrectly()
    {
        // Simulates an edition with RegistrationOpens/Closes both empty, whose already-resolved
        // effective RegistrationStatus (from ComputeEffectiveRegistrationStatus) is handed in here
        // unchanged — this helper never re-derives from raw dates itself.
        var effectiveRegStatus = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.NotRequired, null, null, DateTime.UtcNow);

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, effectiveRegStatus,
            null, null, null, ArbitraryNow);

        Assert.Equal(TicketStatus.Free, result);
    }

    // ─── Per-race registration-opens window (#1553) ───

    [Fact]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_StartTimeSet_BeforeOpensInstant_ReturnsNotStarted()
    {
        // Race on D, 19:30, opens 2880 minutes (2 days) before — before 19:30 on D-2, must read
        // NotStarted regardless of the edition's own window (here: Open, which would otherwise
        // map to Available).
        var dateOfRace = new DateOnly(2026, 6, 10);
        var startTime = new TimeOnly(19, 30);
        var now = new DateTime(2026, 6, 8, 19, 29, 0, DateTimeKind.Utc); // 1 minute before D-2 19:30

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Open,
            dateOfRace, startTime, 2880, now);

        Assert.Equal(TicketStatus.NotStarted, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_StartTimeSet_AtOpensInstant_ReturnsAvailable()
    {
        // At/after 19:30 on D-2 days: Available, independent of the edition's own window and of
        // any sibling race's own offset — RegistrationStatus.Closed here stands in for "the
        // edition's window says something else entirely" and must still be overridden.
        var dateOfRace = new DateOnly(2026, 6, 10);
        var startTime = new TimeOnly(19, 30);
        var now = new DateTime(2026, 6, 8, 19, 30, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Closed,
            dateOfRace, startTime, 2880, now);

        Assert.Equal(TicketStatus.Available, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_NullStartTime_FallsBackToLocalMidnightOfDateOfRace()
    {
        // Mirrors hasRaceStarted's fallback (frontend/utils/ticketStatus.ts) — no StartTime means
        // the race instant is local midnight of DateOfRace, so the opens instant is that midnight
        // minus the offset.
        var dateOfRace = new DateOnly(2026, 6, 10);
        var oneMinuteBeforeOpens = new DateTime(2026, 6, 8, 23, 59, 0, DateTimeKind.Utc); // 1 minute before midnight(D-1)
        var atOpens = new DateTime(2026, 6, 9, 0, 0, 0, DateTimeKind.Utc); // midnight(D-1) == midnight(D) minus the 1440-minute offset

        var before = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Open,
            dateOfRace, null, 1440, oneMinuteBeforeOpens);
        var atOrAfter = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Open,
            dateOfRace, null, 1440, atOpens);

        Assert.Equal(TicketStatus.NotStarted, before);
        Assert.Equal(TicketStatus.Available, atOrAfter);
    }

    [Theory]
    [InlineData(TicketStatus.SoldOut)]
    [InlineData(TicketStatus.AlmostSoldOut)]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_StoredSoldOutOrAlmostSoldOut_StillWins(TicketStatus stored)
    {
        // A manual sold-out override wins over the per-race opens window exactly as it already
        // does over the edition-derived mapping.
        var dateOfRace = new DateOnly(2026, 6, 10);
        var now = new DateTime(2026, 6, 10, 0, 0, 0, DateTimeKind.Utc); // well within the open window

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, stored, RegistrationStatus.Open,
            dateOfRace, null, 2880, now);

        Assert.Equal(stored, result);
    }

    [Theory]
    [InlineData(RegistrationStatus.NotRequired, TicketStatus.Free)]
    [InlineData(RegistrationStatus.Invitational, TicketStatus.Invitational)]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_EditionNotRequiredOrInvitational_StillWins(
        RegistrationStatus editionStatus, TicketStatus expected)
    {
        // NotRequired/Invitational are deliberate overrides on the edition's own registration
        // status and have nothing to do with timing — the per-race opens window must not engage
        // at all, even though dateOfRace/offset are both set and `now` is well before the would-be
        // opens instant.
        var dateOfRace = new DateOnly(2026, 6, 10);
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc); // long before opens

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, editionStatus,
            dateOfRace, null, 2880, now);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_NullOffset_FallsBackToEditionDerivedStatus()
    {
        // RegistrationOpensMinutesBeforeRace null (default) — regression guard: with dateOfRace
        // set but no offset, the branch never engages and the edition-derived switch decides.
        var dateOfRace = new DateOnly(2026, 6, 10);
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Open,
            dateOfRace, null, null, now);

        Assert.Equal(TicketStatus.Available, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_NullDateOfRace_OffsetHasNoEffect()
    {
        // RegistrationOpensMinutesBeforeRace set but DateOfRace null — the branch never engages
        // (nothing to compute a race instant from), so the edition-derived switch decides.
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Closed,
            null, null, 2880, now);

        Assert.Equal(TicketStatus.Closed, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_PerRaceWindow_RaceCompletedAfterSweep_ReturnsClosedRegardlessOfOffset()
    {
        // RaceCompletionSweep has already run (RaceStatus.Completed, TicketStatus.Closed) once
        // DateOfRace passes — that terminal state must win over the per-race opens window exactly
        // as it already wins over the edition-derived mapping, even though `now` here is well
        // within what would otherwise read as the open window.
        var dateOfRace = new DateOnly(2026, 6, 10);
        var now = new DateTime(2026, 6, 10, 12, 0, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Completed, TicketStatus.Closed, RegistrationStatus.Open,
            dateOfRace, null, 2880, now);

        Assert.Equal(TicketStatus.Closed, result);
    }

    // ─── SeriesRaceDates (#1292) ───

    private static Race MakeRace(DateOnly? dateOfRace, RaceStatus status = RaceStatus.Active) =>
        new() { DateOfRace = dateOfRace, Status = status };

    [Fact]
    public void SeriesRaceDates_MixOfDatedAndUndatedRaces_ReturnsOnlyDatedOnes()
    {
        var races = new[]
        {
            MakeRace(new DateOnly(2026, 4, 1)),
            MakeRace(null),
            MakeRace(new DateOnly(2026, 8, 20)),
        };

        var result = EditionStatusHelpers.SeriesRaceDates(races);

        Assert.Equal([new DateOnly(2026, 4, 1), new DateOnly(2026, 8, 20)], result);
    }

    [Fact]
    public void SeriesRaceDates_DatedCancelledRace_IsExcluded()
    {
        // #1261: a Cancelled race's date must not count toward the derived min/max.
        var races = new[]
        {
            MakeRace(new DateOnly(2026, 4, 1), RaceStatus.Cancelled),
            MakeRace(new DateOnly(2026, 8, 20)),
        };

        var result = EditionStatusHelpers.SeriesRaceDates(races);

        Assert.Equal([new DateOnly(2026, 8, 20)], result);
    }

    [Fact]
    public void SeriesRaceDates_AllRacesCancelledOrUndated_ReturnsEmpty()
    {
        var races = new[]
        {
            MakeRace(new DateOnly(2026, 4, 1), RaceStatus.Cancelled),
            MakeRace(null),
        };

        var result = EditionStatusHelpers.SeriesRaceDates(races);

        Assert.Empty(result);
    }

    [Fact]
    public void IsEditionDateDerivedFromRaces_SeriesWithDatedRace_ReturnsTrue()
    {
        var result = EditionStatusHelpers.IsEditionDateDerivedFromRaces(
            EventType.Series, [new DateOnly(2026, 4, 1)]);

        Assert.True(result);
    }

    [Fact]
    public void IsEditionDateDerivedFromRaces_SeriesWithNoDatedRaces_ReturnsFalse()
    {
        var result = EditionStatusHelpers.IsEditionDateDerivedFromRaces(EventType.Series, []);

        Assert.False(result);
    }

    [Theory]
    [InlineData(EventType.Race)]
    [InlineData(EventType.Social)]
    [InlineData(EventType.Advertisement)]
    [InlineData(EventType.Festival)]
    [InlineData(EventType.Other)]
    public void IsEditionDateDerivedFromRaces_NonSeriesEventTypeWithDatedRaces_ReturnsFalse(EventType eventType)
    {
        // Mirrors ComputeEffectiveEditionDates_NonSeriesEventType_ReturnsStoredDatesEvenWithRaces
        // below — the write-side gate must agree with the read-side one on every non-Series type,
        // or the two would drift and reintroduce exactly the bug this helper exists to prevent.
        var result = EditionStatusHelpers.IsEditionDateDerivedFromRaces(
            eventType, [new DateOnly(2026, 4, 1), new DateOnly(2026, 8, 20)]);

        Assert.False(result);
    }

    [Fact]
    public void ComputeEffectiveEditionDates_SeriesWithRaces_ReturnsMinMaxOfRaceDates()
    {
        var storedDate = new DateOnly(2026, 1, 1);
        var storedEndDate = new DateOnly(2026, 1, 2);
        var raceDates = new List<DateOnly>
        {
            new(2026, 6, 15),
            new(2026, 4, 1),
            new(2026, 8, 20),
        };

        var result = EditionStatusHelpers.ComputeEffectiveEditionDates(
            EventType.Series, storedDate, storedEndDate, raceDates);

        Assert.Equal(new DateOnly(2026, 4, 1), result.Date);
        Assert.Equal(new DateOnly(2026, 8, 20), result.EndDate);
    }

    [Fact]
    public void ComputeEffectiveEditionDates_SeriesWithSingleRace_ReturnsThatDateForBothDateAndEndDate()
    {
        var raceDate = new DateOnly(2026, 5, 10);

        var result = EditionStatusHelpers.ComputeEffectiveEditionDates(
            EventType.Series, null, null, [raceDate]);

        Assert.Equal(raceDate, result.Date);
        Assert.Equal(raceDate, result.EndDate);
    }

    [Fact]
    public void ComputeEffectiveEditionDates_SeriesWithNoDatedRaces_FallsBackToStoredDates()
    {
        // Chicken-and-egg case: a brand-new Series edition with no races yet has nothing to
        // derive from, so the raw stored values must pass through unchanged.
        var storedDate = new DateOnly(2026, 1, 1);
        var storedEndDate = new DateOnly(2026, 1, 2);

        var result = EditionStatusHelpers.ComputeEffectiveEditionDates(
            EventType.Series, storedDate, storedEndDate, []);

        Assert.Equal(storedDate, result.Date);
        Assert.Equal(storedEndDate, result.EndDate);
    }

    [Theory]
    [InlineData(EventType.Race)]
    [InlineData(EventType.Social)]
    [InlineData(EventType.Advertisement)]
    [InlineData(EventType.Festival)]
    [InlineData(EventType.Other)]
    public void ComputeEffectiveEditionDates_NonSeriesEventType_ReturnsStoredDatesEvenWithRaces(EventType eventType)
    {
        // Non-Series editions are unaffected by this helper regardless of how many dated races
        // they have — the stored Date/EndDate remain the source of truth.
        var storedDate = new DateOnly(2026, 1, 1);
        var storedEndDate = new DateOnly(2026, 1, 2);
        var raceDates = new List<DateOnly> { new(2026, 6, 15), new(2026, 8, 20) };

        var result = EditionStatusHelpers.ComputeEffectiveEditionDates(
            eventType, storedDate, storedEndDate, raceDates);

        Assert.Equal(storedDate, result.Date);
        Assert.Equal(storedEndDate, result.EndDate);
    }

    [Fact]
    public void ComputeEffectiveEditionDates_SeriesWithNoRacesAndNoStoredDates_ReturnsNullForBoth()
    {
        var result = EditionStatusHelpers.ComputeEffectiveEditionDates(
            EventType.Series, null, null, []);

        Assert.Null(result.Date);
        Assert.Null(result.EndDate);
    }

    // ─── ResolveNextEditionDate (#1320) ───

    private static readonly IScheduleRuleEngine ScheduleEngine = new ScheduleRuleEngine();

    private static EventEdition MakeEdition(DateOnly? date, DateOnly? endDate = null) =>
        new() { Id = Guid.NewGuid(), Date = date, EndDate = endDate };

    private static DateOnly? EffDate(EventEdition? ed) => ed?.Date;
    private static DateOnly? EffEndDate(EventEdition? ed) => ed?.EndDate;

    [Fact]
    public void ResolveNextEditionDate_FutureNotYetStartedEdition_ReturnsItsStartDate()
    {
        // Unchanged pre-#1320 behaviour: an edition that hasn't started yet (even a multi-day one
        // with its own EndDate also in the future) surfaces its start date, not its last day.
        var today = new DateOnly(2026, 6, 1);
        var edition = MakeEdition(new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 3));

        var result = EditionStatusHelpers.ResolveNextEditionDate(
            [edition], today, EffDate, EffEndDate, null, ScheduleEngine);

        Assert.Equal(new DateOnly(2026, 7, 1), result);
    }

    [Fact]
    public void ResolveNextEditionDate_StartedButNotEndedEdition_ReturnsEndDateNotStaleScheduleRule()
    {
        // The #1320 bug: an edition's start Date has already passed, but a later date within the
        // same edition (its derived/stored EndDate) hasn't — this must surface that EndDate, not
        // fall through to the ScheduleRule the old Date-only comparison used to fall back to.
        var today = new DateOnly(2026, 10, 12);
        var edition = MakeEdition(new DateOnly(2026, 10, 3), new DateOnly(2026, 10, 31));
        var staleScheduleRule = new ScheduleRule { Type = ScheduleType.Fixed, Date = new DateOnly(2027, 9, 25) };

        var result = EditionStatusHelpers.ResolveNextEditionDate(
            [edition], today, EffDate, EffEndDate, staleScheduleRule, ScheduleEngine);

        Assert.Equal(new DateOnly(2026, 10, 31), result);
    }

    [Fact]
    public void ResolveNextEditionDate_FullyPastEdition_FallsBackToScheduleRule()
    {
        // An edition that has genuinely ended (both Date and EndDate in the past) must not qualify
        // — the ScheduleRule fallback is correct here, unlike the "started but not ended" case above.
        var today = new DateOnly(2026, 10, 12);
        var edition = MakeEdition(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 3));
        var scheduleRule = new ScheduleRule { Type = ScheduleType.Fixed, Date = new DateOnly(2027, 9, 25) };

        var result = EditionStatusHelpers.ResolveNextEditionDate(
            [edition], today, EffDate, EffEndDate, scheduleRule, ScheduleEngine);

        Assert.Equal(new DateOnly(2027, 9, 25), result);
    }

    [Fact]
    public void ResolveNextEditionDate_NoEditionsAndNoScheduleRule_ReturnsNull()
    {
        var today = new DateOnly(2026, 10, 12);

        var result = EditionStatusHelpers.ResolveNextEditionDate(
            [], today, EffDate, EffEndDate, null, ScheduleEngine);

        Assert.Null(result);
    }

    [Fact]
    public void ResolveNextEditionDate_MultipleQualifyingEditions_ReturnsTheSoonestCandidate()
    {
        var today = new DateOnly(2026, 10, 12);
        // Already underway, candidate = its EndDate (Oct 31).
        var ongoing = MakeEdition(new DateOnly(2026, 10, 3), new DateOnly(2026, 10, 31));
        // Not yet started, candidate = its own start Date (Oct 20) — earlier than the ongoing
        // edition's candidate above, so this must win.
        var upcoming = MakeEdition(new DateOnly(2026, 10, 20));

        var result = EditionStatusHelpers.ResolveNextEditionDate(
            [ongoing, upcoming], today, EffDate, EffEndDate, null, ScheduleEngine);

        Assert.Equal(new DateOnly(2026, 10, 20), result);
    }

    [Fact]
    public void ResolveNextEditionDate_DatelessEditionWithFutureEndDate_FallsBackToScheduleRule()
    {
        // #1327: an edition with Date == null but a future EndDate must not qualify as "next" —
        // every other edition-scoped field (ongoingEdition/relevantEdition) ignores it because it
        // has no Date at all, so NextEditionDate must agree and fall through to the ScheduleRule.
        var today = new DateOnly(2026, 10, 12);
        var edition = MakeEdition(null, new DateOnly(2026, 10, 31));
        var scheduleRule = new ScheduleRule { Type = ScheduleType.Fixed, Date = new DateOnly(2027, 9, 25) };

        var result = EditionStatusHelpers.ResolveNextEditionDate(
            [edition], today, EffDate, EffEndDate, scheduleRule, ScheduleEngine);

        Assert.Equal(new DateOnly(2027, 9, 25), result);
    }

    [Fact]
    public void ResolveNextEditionDate_DatelessEditionWithFutureEndDateAndNoScheduleRule_ReturnsNull()
    {
        // Same as above, but with no ScheduleRule to fall back to — the dateless edition must
        // still be excluded, so the overall result is null rather than its EndDate.
        var today = new DateOnly(2026, 10, 12);
        var edition = MakeEdition(null, new DateOnly(2026, 10, 31));

        var result = EditionStatusHelpers.ResolveNextEditionDate(
            [edition], today, EffDate, EffEndDate, null, ScheduleEngine);

        Assert.Null(result);
    }

    [Fact]
    public void AsUtc_NullValue_ReturnsNull()
    {
        var result = EditionStatusHelpers.AsUtc(null);
        Assert.Null(result);
    }

    [Fact]
    public void AsUtc_UnspecifiedKind_RelabelsAsUtcWithoutShiftingTheValue()
    {
        var unspecified = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Unspecified);

        var result = EditionStatusHelpers.AsUtc(unspecified);

        Assert.NotNull(result);
        Assert.Equal(DateTimeKind.Utc, result!.Value.Kind);
        Assert.Equal(unspecified.Ticks, result!.Value.Ticks);
    }
}

using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Core.Entities;

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
    public void ComputeEffectiveRegistrationStatus_LateOnTheClosesDateItself_StillReturnsOpen()
    {
        // RegistrationCloses is a date-only pick under the hood (midnight UTC via AsUtc) — the
        // whole calendar day it names must still read as Open, not just the instant of midnight.
        var opens = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var closes = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 3, 1, 23, 59, 0, DateTimeKind.Utc);

        var result = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
            EditionStatus.Active, RegistrationStatus.Open, opens, closes, now);

        Assert.Equal(RegistrationStatus.Open, result);
    }

    [Fact]
    public void ComputeEffectiveRegistrationStatus_MidnightStartingTheDayAfterCloses_ReturnsClosed()
    {
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

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionNotStarted_RaceAvailable_ReturnsNotStarted()
    {
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.NotStarted);

        Assert.Equal(TicketStatus.NotStarted, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionOpen_ReturnsAvailable()
    {
        // Same edition as the NotStarted case above but registration has since opened — the
        // race's effective ticket status must flip on the next read with no write/sweep needed.
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Open);

        Assert.Equal(TicketStatus.Available, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionClosed_ReturnsClosed()
    {
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.Closed);

        Assert.Equal(TicketStatus.Closed, result);
    }

    [Fact]
    public void ComputeEffectiveTicketStatus_EditionNotRequired_ReturnsFree()
    {
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, TicketStatus.Available, RegistrationStatus.NotRequired);

        Assert.Equal(TicketStatus.Free, result);
    }

    [Theory]
    [InlineData(TicketStatus.SoldOut)]
    [InlineData(TicketStatus.AlmostSoldOut)]
    public void ComputeEffectiveTicketStatus_StoredSoldOutOrAlmostSoldOut_ReturnsUnchangedRegardlessOfEditionState(TicketStatus stored)
    {
        // A manual sold-out override has nothing to do with the registration window timing and
        // must not be clobbered by a live computation, even if the edition reads as freshly Open.
        var result = EditionStatusHelpers.ComputeEffectiveTicketStatus(
            RaceStatus.Active, stored, RegistrationStatus.Open);

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
            raceStatus, TicketStatus.Closed, RegistrationStatus.Open);

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
            RaceStatus.Active, TicketStatus.Available, effectiveRegStatus);

        Assert.Equal(TicketStatus.Free, result);
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

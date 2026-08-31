using Utanvega.Backend.Core.Entities;

namespace backend.Tests.Entities;

public class EventTests
{
    private static readonly DateOnly Today = new(2026, 8, 31);

    private static Event CreateEventWithEditions(params EventEdition[] editions)
    {
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Test Event",
            Slug = "test-event",
            Status = EventStatus.Confirmed,
        };
        foreach (var edition in editions)
        {
            edition.EventId = ev.Id;
            ev.Editions.Add(edition);
        }
        return ev;
    }

    private static EventEdition CreateEdition(EditionStatus status, DateOnly? date = null, params Race[] races)
    {
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            Status = status,
            Date = date,
            RegistrationStatus = RegistrationStatus.Open,
        };
        foreach (var race in races)
        {
            race.EventEditionId = edition.Id;
            edition.Races.Add(race);
        }
        return edition;
    }

    [Fact]
    public void CancelWithEditions_SetsEventStatusToCancelled()
    {
        var ev = CreateEventWithEditions();
        ev.CancelWithEditions(Today);
        Assert.Equal(EventStatus.Cancelled, ev.Status);
    }

    [Fact]
    public void CancelWithEditions_CascadesToFutureDatedActiveEdition()
    {
        var race = new Race { Id = Guid.NewGuid(), Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };
        var edition = CreateEdition(EditionStatus.Active, Today.AddDays(30), race);
        var ev = CreateEventWithEditions(edition);

        ev.CancelWithEditions(Today);

        Assert.Equal(EditionStatus.Cancelled, edition.Status);
        Assert.Equal(RegistrationStatus.Closed, edition.RegistrationStatus);
        Assert.Equal(RaceStatus.Cancelled, race.Status);
        Assert.Equal(TicketStatus.Closed, race.TicketStatus);
    }

    [Fact]
    public void CancelWithEditions_CascadesToUndatedActiveEdition()
    {
        var edition = CreateEdition(EditionStatus.Active, date: null);
        var ev = CreateEventWithEditions(edition);

        ev.CancelWithEditions(Today);

        Assert.Equal(EditionStatus.Cancelled, edition.Status);
    }

    [Fact]
    public void CancelWithEditions_LeavesCompletedEditionUntouched()
    {
        var edition = CreateEdition(EditionStatus.Completed, Today.AddDays(30));
        var ev = CreateEventWithEditions(edition);

        ev.CancelWithEditions(Today);

        Assert.Equal(EditionStatus.Completed, edition.Status);
    }

    [Fact]
    public void CancelWithEditions_LeavesAlreadyCancelledEditionUntouched()
    {
        // Idempotent: an edition already Cancelled for its own (possibly unrelated) reason is
        // skipped rather than re-cancelled, mirroring CancelWithRaces' treatment of already
        // cancelled races.
        var edition = CreateEdition(EditionStatus.Cancelled, Today.AddDays(30));
        edition.RegistrationStatus = RegistrationStatus.NotRequired;
        var ev = CreateEventWithEditions(edition);

        ev.CancelWithEditions(Today);

        Assert.Equal(EditionStatus.Cancelled, edition.Status);
        Assert.Equal(RegistrationStatus.NotRequired, edition.RegistrationStatus);
    }

    [Fact]
    public void CancelWithEditions_LeavesPastDatedActiveEditionUntouched()
    {
        // Past-dated Active editions are stale/overdue-unconfirmed data, not upcoming events — they
        // must not be asserted as Cancelled just because the parent event was.
        var edition = CreateEdition(EditionStatus.Active, Today.AddDays(-1));
        var ev = CreateEventWithEditions(edition);

        ev.CancelWithEditions(Today);

        Assert.Equal(EditionStatus.Active, edition.Status);
    }

    [Fact]
    public void CancelWithEditions_UsesEndDate_WhenPresent_ToDetermineFuture()
    {
        // Multi-day edition that started in the past but hasn't ended yet must still be treated as
        // in-progress/future, not stale.
        var edition = CreateEdition(EditionStatus.Active, Today.AddDays(-1));
        edition.EndDate = Today.AddDays(1);
        var ev = CreateEventWithEditions(edition);

        ev.CancelWithEditions(Today);

        Assert.Equal(EditionStatus.Cancelled, edition.Status);
    }

    [Fact]
    public void CancelWithEditions_CascadesToMultipleQualifyingEditions_SkipsNonQualifying()
    {
        var future = CreateEdition(EditionStatus.Active, Today.AddDays(10));
        var completed = CreateEdition(EditionStatus.Completed, Today.AddDays(-100));
        var alreadyCancelled = CreateEdition(EditionStatus.Cancelled, Today.AddDays(10));
        var pastActive = CreateEdition(EditionStatus.Active, Today.AddDays(-10));
        var ev = CreateEventWithEditions(future, completed, alreadyCancelled, pastActive);

        ev.CancelWithEditions(Today);

        Assert.Equal(EditionStatus.Cancelled, future.Status);
        Assert.Equal(EditionStatus.Completed, completed.Status);
        Assert.Equal(EditionStatus.Cancelled, alreadyCancelled.Status);
        Assert.Equal(EditionStatus.Active, pastActive.Status);
    }
}

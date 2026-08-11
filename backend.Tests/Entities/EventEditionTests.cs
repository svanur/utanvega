using Utanvega.Backend.Core.Entities;

namespace backend.Tests.Entities;

public class EventEditionTests
{
    private static EventEdition CreateEditionWithRaces(params Race[] races)
    {
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid(),
            Status = EditionStatus.Active,
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
    public void CancelWithRaces_SetsEditionStatusToCancelled()
    {
        var edition = CreateEditionWithRaces();
        edition.CancelWithRaces();
        Assert.Equal(EditionStatus.Cancelled, edition.Status);
    }

    [Fact]
    public void CancelWithRaces_ClosesRegistration()
    {
        var edition = CreateEditionWithRaces();
        edition.CancelWithRaces();
        Assert.Equal(RegistrationStatus.Closed, edition.RegistrationStatus);
    }

    [Fact]
    public void CancelWithRaces_CascadesActiveRaceToCancelled()
    {
        var race = new Race { Id = Guid.NewGuid(), Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };
        var edition = CreateEditionWithRaces(race);

        edition.CancelWithRaces();

        Assert.Equal(RaceStatus.Cancelled, race.Status);
    }

    [Fact]
    public void CancelWithRaces_ClosesTicketStatus_ForCascadedRace()
    {
        var race = new Race { Id = Guid.NewGuid(), Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.SoldOut };
        var edition = CreateEditionWithRaces(race);

        edition.CancelWithRaces();

        Assert.Equal(TicketStatus.Closed, race.TicketStatus);
    }

    [Fact]
    public void CancelWithRaces_CascadesMultipleRaces()
    {
        var race1 = new Race { Id = Guid.NewGuid(), Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };
        var race2 = new Race { Id = Guid.NewGuid(), Name = "21K", SortOrder = 1, Status = RaceStatus.Completed, TicketStatus = TicketStatus.Closed };
        var edition = CreateEditionWithRaces(race1, race2);

        edition.CancelWithRaces();

        Assert.Equal(RaceStatus.Cancelled, race1.Status);
        Assert.Equal(RaceStatus.Cancelled, race2.Status);
    }

    [Fact]
    public void CancelWithRaces_LeavesAlreadyCancelledRaceUntouched()
    {
        // Already-cancelled races are skipped entirely — this also verifies TicketStatus isn't
        // force-reset for a race that may have been cancelled for an unrelated, prior reason.
        var race = new Race { Id = Guid.NewGuid(), Name = "10K", SortOrder = 0, Status = RaceStatus.Cancelled, TicketStatus = TicketStatus.NotStarted };
        var edition = CreateEditionWithRaces(race);

        edition.CancelWithRaces();

        Assert.Equal(RaceStatus.Cancelled, race.Status);
        Assert.Equal(TicketStatus.NotStarted, race.TicketStatus);
    }

    [Fact]
    public void CancelWithRaces_NoRaces_OnlyUpdatesEdition()
    {
        var edition = CreateEditionWithRaces();
        edition.CancelWithRaces();
        Assert.Equal(EditionStatus.Cancelled, edition.Status);
        Assert.Empty(edition.Races);
    }
}

namespace Utanvega.Backend.Core.Entities;

public enum RegistrationStatus
{
    NotStarted,
    Open,
    Closed,
}

public enum EditionStatus
{
    Active,
    Unconfirmed,
    Cancelled,
    Hidden,
}

public class EventEdition
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid EventId { get; set; }
    public Event Event { get; set; } = null!;

    public Guid? TrailId { get; set; }
    public Trail? Trail { get; set; }

    public int? Year { get; set; }
    public DateOnly? Date { get; set; }
    public DateOnly? EndDate { get; set; }

    public string? Title { get; set; }
    public string? TitleEn { get; set; }
    public string? RegistrationUrl { get; set; }
    public string? ResultsUrl { get; set; }
    public string? Notes { get; set; }
    public string? NotesEn { get; set; }

    public string? TranslationHashes { get; set; }

    public RegistrationStatus RegistrationStatus { get; set; } = RegistrationStatus.NotStarted;
    public EditionStatus Status { get; set; } = EditionStatus.Active;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<Race> Races { get; set; } = new List<Race>();

    // Cancelling an edition always cascades: its races are force-set to Cancelled and registration
    // is closed, regardless of which admin action (dedicated Cancel button, or the generic Status
    // field) triggered the transition into Cancelled — there's no legitimate case for an edition to
    // read as Cancelled while its races still look active.
    public void CancelWithRaces()
    {
        Status = EditionStatus.Cancelled;
        RegistrationStatus = RegistrationStatus.Closed;
        foreach (var race in Races.Where(r => r.Status != RaceStatus.Cancelled))
        {
            race.Status = RaceStatus.Cancelled;
            race.TicketStatus = TicketStatus.Closed;
        }
    }
}

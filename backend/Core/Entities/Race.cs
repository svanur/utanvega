namespace Utanvega.Backend.Core.Entities;

public enum RaceStatus
{
    Active,
    Cancelled,
    Upcoming,
    Hidden,
}

public enum TicketStatus
{
    Available,
    SoldOut,
}

public class Race
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid EventEditionId { get; set; }
    public EventEdition EventEdition { get; set; } = null!;

    public Guid? TrailId { get; set; }
    public Trail? Trail { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? DistanceLabel { get; set; }
    public int? CutoffMinutes { get; set; }
    public string? Description { get; set; }
    public RaceStatus Status { get; set; } = RaceStatus.Active;
    public int SortOrder { get; set; }

    public TicketStatus TicketStatus { get; set; } = TicketStatus.Available;
    public int? MaxParticipants { get; set; }

    public int? ItraPoints { get; set; }
    public string? CertifiedBy { get; set; }
    public decimal PrizeMoney { get; set; } = 0;
    public string? ChampionshipCategory { get; set; }

    public DateOnly? DateOfRace { get; set; }
    public TimeOnly? StartTime { get; set; }
}

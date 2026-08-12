namespace Utanvega.Backend.Core.Entities;

public enum RaceStatus
{
    Active,
    Cancelled,
    Hidden,
    Completed,
}

public enum TicketStatus
{
    Available,
    AlmostSoldOut,
    SoldOut,
    Closed,
    NotStarted,
    Free,
}

public enum ResultType
{
    Time,
    Distance,
    Laps,
}

public class Race
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid EventEditionId { get; set; }
    public EventEdition EventEdition { get; set; } = null!;

    public Guid? TrailId { get; set; }
    public Trail? Trail { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public string? DistanceLabel { get; set; }
    public string? DistanceLabelEn { get; set; }
    public int? CutoffMinutes { get; set; }
    public string? Description { get; set; }
    public string? DescriptionEn { get; set; }
    public RaceStatus Status { get; set; } = RaceStatus.Active;
    public int SortOrder { get; set; }

    public TicketStatus TicketStatus { get; set; } = TicketStatus.Available;
    public ResultType ResultType { get; set; } = ResultType.Time;
    public int? MaxParticipants { get; set; }

    public int? ItraPoints { get; set; }
    public string? CertifiedBy { get; set; }
    public string? CertifiedByEn { get; set; }
    public decimal PrizeMoney { get; set; } = 0;
    public string? ChampionshipCategory { get; set; }
    public string? ChampionshipCategoryEn { get; set; }

    public DateOnly? DateOfRace { get; set; }
    public TimeOnly? StartTime { get; set; }

    public ActivityType? ActivityType { get; set; }

    public string? TranslationHashes { get; set; }
}

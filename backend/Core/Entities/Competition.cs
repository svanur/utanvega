namespace Utanvega.Backend.Core.Entities;

public enum CompetitionStatus
{
    Active,
    Cancelled,
    Retired,
}

public class Competition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }

    public string? OrganizerName { get; set; }
    public string? OrganizerWebsite { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }

    public CompetitionStatus Status { get; set; } = CompetitionStatus.Active;

    public ScheduleRule? ScheduleRule { get; set; }

    // Auditing
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<Race> Races { get; set; } = new List<Race>();
}

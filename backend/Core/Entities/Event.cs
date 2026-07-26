namespace Utanvega.Backend.Core.Entities;

public enum EventType
{
    Race,
    Series,
    Advertisement,
    Festival,
    Other,
}

public enum EventStatus
{
    Unconfirmed,
    Confirmed,
    Cancelled,
    Hidden,
    Unlisted,
}

public class SocialLink
{
    public string Type { get; set; } = string.Empty; // e.g. "Facebook", "Instagram", "Website"
    public string Url { get; set; } = string.Empty;
}

public class Event
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }

    public EventType Type { get; set; } = EventType.Race;
    public ActivityType ActivityType { get; set; } = ActivityType.TrailRunning;
    public EventStatus Status { get; set; } = EventStatus.Unconfirmed;

    public string? OrganizerName { get; set; }
    public string? OrganizerWebsite { get; set; }

    public string? AlertMessage { get; set; }
    public string? AlertSeverity { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }

    public double? GpxPointLat { get; set; }
    public double? GpxPointLng { get; set; }

    public ScheduleRule? ScheduleRule { get; set; }

    public List<SocialLink>? SocialLinks { get; set; }

    // Auditing
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<EventEdition> Editions { get; set; } = new List<EventEdition>();
}

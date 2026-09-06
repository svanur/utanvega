namespace Utanvega.Backend.Core.Entities;

public enum EventType
{
    Race,
    Series,
    Social,
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
    public string? NameEn { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? DescriptionEn { get; set; }

    public EventType Type { get; set; } = EventType.Race;
    public ActivityType ActivityType { get; set; } = ActivityType.TrailRunning;
    public EventStatus Status { get; set; } = EventStatus.Unconfirmed;

    public string? OrganizerName { get; set; }
    public string? OrganizerNameEn { get; set; }
    public string? OrganizerWebsite { get; set; }

    public Guid? OrganizerId { get; set; }
    public Organizer? Organizer { get; set; }

    public string? AlertMessage { get; set; }
    public string? AlertMessageEn { get; set; }
    public string? AlertSeverity { get; set; }

    public string? TranslationHashes { get; set; }

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

    // Cancelling an event cascades to its editions, but not indiscriminately: editions that are
    // already Completed or already Cancelled are left alone (nothing to override), and editions
    // whose effective date has already passed are also left alone — a past-dated Active or
    // Unconfirmed edition is stale, unconfirmed data, not an upcoming occurrence, and asserting it
    // as Cancelled would misrepresent history rather than prevent something from happening. Every
    // other edition — future-dated or undated — cascades via CancelWithRaces(), so its races and
    // registration close exactly the way a direct, edition-level cancellation would.
    public void CancelWithEditions(DateOnly today)
    {
        Status = EventStatus.Cancelled;
        foreach (var edition in Editions.Where(ed =>
                     ed.Status != EditionStatus.Completed &&
                     ed.Status != EditionStatus.Cancelled &&
                     IsFutureOrUndated(ed, today)))
        {
            edition.CancelWithRaces();
        }
    }

    private static bool IsFutureOrUndated(EventEdition edition, DateOnly today)
    {
        var effectiveDate = edition.EndDate ?? edition.Date;
        return !effectiveDate.HasValue || effectiveDate.Value >= today;
    }
}

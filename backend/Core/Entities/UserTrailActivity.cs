namespace Utanvega.Backend.Core.Entities;

public class UserTrailActivity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TrailSlug { get; set; } = string.Empty;
    public DateOnly? LogDate { get; set; }
    public int TimeInSeconds { get; set; } // stored as total seconds
    public decimal? Distance { get; set; } // in km
    public int? ElevationGain { get; set; } // in meters
    public string? Notes { get; set; }
    public bool IsPublic { get; set; } = false;
    public DateTimeOffset LoggedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

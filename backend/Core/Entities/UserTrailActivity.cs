namespace Utanvega.Backend.Core.Entities;

public class UserTrailActivity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TrailSlug { get; set; } = string.Empty;
    public int Time { get; set; } // in minutes
    public decimal? Distance { get; set; } // in km
    public int? ElevationGain { get; set; } // in meters
    public DateOnly? LogDate { get; set; }
    public string? Notes { get; set; }
    public bool IsPublic { get; set; } = false;
    public DateTimeOffset LoggedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

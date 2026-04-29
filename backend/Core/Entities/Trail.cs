namespace Utanvega.Backend.Core.Entities;

using NetTopologySuite.Geometries;

public enum ActivityType
{
    TrailRunning,
    Running,
    Cycling,
    Hiking,
}

public enum TrailStatus
{
    Draft,
    Published,
    Flagged,
    Archived,
    Deleted,
    RaceOnly,
}

public enum Difficulty
{
    Easy,
    Moderate,
    Hard,
    Expert,
    Extreme,
}

public enum Visibility
{
    Public,
    Friends,
    Private,
}

public enum TrailType
{
    OutAndBack,
    Loop,
    PointToPoint,
}

public class Trail
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    public ActivityType ActivityTypeId { get; set; }
    public TrailStatus Status { get; set; } = TrailStatus.Draft;
    public TrailType Type { get; set; } = TrailType.Loop;
    
    public double Length { get; set; } // in meters
    public double ElevationGain { get; set; } // in meters
    public double ElevationLoss { get; set; } // in meters
    
    public Difficulty Difficulty { get; set; } = Difficulty.Moderate;
    public Visibility Visibility { get; set; } = Visibility.Public;
    
    // NetTopologySuite for PostGIS
    public Geometry? GpxData { get; set; }
    
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Relationships
    public ICollection<TrailLocation> TrailLocations { get; set; } = new List<TrailLocation>();
    public ICollection<TrailTag> TrailTags { get; set; } = new List<TrailTag>();
}

namespace Utanvega.Backend.Core.Entities;

using NetTopologySuite.Geometries;

public enum LocationType
{
    Country,
    Area,
    Region,
    Municipality,
    Place,
    Other,
}

public class Location
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    public LocationType Type { get; set; } = LocationType.Place;
    
    // Hierarchy
    public Guid? ParentId { get; set; }
    public Location? Parent { get; set; }
    public ICollection<Location> Children { get; set; } = new List<Location>();
    
    // Spatial
    public Point? Center { get; set; }
    public double? Radius { get; set; } // in meters
    
    // Auditing
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // Relationships
    public ICollection<TrailLocation> TrailLocations { get; set; } = new List<TrailLocation>();
}

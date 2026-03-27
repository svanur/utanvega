namespace Utanvega.Backend.Core.Entities;

public enum TrailLocationRole
{
    Start,
    End,
    BelongsTo,
    PassingThrough,
    Near,
}

public class TrailLocation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TrailId { get; set; }
    public Trail Trail { get; set; } = null!;
    
    public Guid LocationId { get; set; }
    public Location Location { get; set; } = null!;
    
    public TrailLocationRole Role { get; set; } = TrailLocationRole.BelongsTo;
}

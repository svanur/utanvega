namespace Utanvega.Backend.Core.Entities;

public class TrailTag
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TrailId { get; set; }
    public Trail Trail { get; set; } = null!;

    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = null!;
}

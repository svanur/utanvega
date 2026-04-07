namespace Utanvega.Backend.Core.Entities;

public class TrailView
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TrailId { get; set; }
    public DateTime ViewedAtUtc { get; set; } = DateTime.UtcNow;
    public string? IpHash { get; set; }

    public Trail Trail { get; set; } = null!;
}

namespace Utanvega.Backend.Core.Entities;

public class TrailCheckIn
{
    public Guid Id { get; set; }
    public Guid TrailId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }

    public Trail? Trail { get; set; }
}

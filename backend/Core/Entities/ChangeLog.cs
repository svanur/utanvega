namespace Utanvega.Backend.Core.Entities;

public class ChangeLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // Create, Update, Delete, Restore
    public string? Description { get; set; }
    public string? Changes { get; set; } // JSON or readable text of what changed
    public string? UserId { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

namespace Utanvega.Backend.Core.Entities;

public class Organizer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Kennitala { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Website { get; set; }
    public string? Description { get; set; }
    public string? DescriptionEn { get; set; }
    public string? ContactName { get; set; }

    public string? TranslationHashes { get; set; }

    // Auditing
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<Event> Events { get; set; } = new List<Event>();
}

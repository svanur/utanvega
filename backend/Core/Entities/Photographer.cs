namespace Utanvega.Backend.Core.Entities;

public class Photographer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Website { get; set; }
    public string? Email { get; set; }
    public string? Description { get; set; }
    public string? DescriptionEn { get; set; }

    public List<SocialLink>? SocialLinks { get; set; }

    public string? TranslationHashes { get; set; }

    // Auditing
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation — SetNull on delete (see UtanvegaDbContext), so this is only used for counting
    // and reassignment; it is never cascade-deleted.
    public ICollection<PhotoGallery> PhotoGalleries { get; set; } = new List<PhotoGallery>();
}

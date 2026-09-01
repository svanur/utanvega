namespace Utanvega.Backend.Core.Entities;

// An EventEdition can have multiple photo galleries (from different photographers), each with its
// own URL and optional attribution. This supersedes EventEdition.PhotoGalleryUrl going forward, but
// that legacy single-URL field is left untouched until #491/#492 migrate consumers off it.
public class PhotoGallery
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid EventEditionId { get; set; }
    public EventEdition EventEdition { get; set; } = null!;

    public string Url { get; set; } = string.Empty;

    // Nullable — a gallery may not (yet) have an attributed photographer.
    public Guid? PhotographerId { get; set; }
    public Photographer? Photographer { get; set; }

    public string? Title { get; set; }
    public string? TitleEn { get; set; }

    public int SortOrder { get; set; }

    // Auditing
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
}

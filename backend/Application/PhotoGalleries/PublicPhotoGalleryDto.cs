using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.PhotoGalleries;

// Narrowed public-facing projection of PhotoGallery — deliberately withholds Id, EventEditionId,
// PhotographerId, CreatedAt/CreatedBy and any other admin/moderation-only field. See
// GetOrganizersPublicQuery / OrganizerPublicDto for the same pattern applied to organizers.
public record PublicPhotoGalleryDto(
    string Url,
    string? Title,
    string? TitleEn,
    string? PhotographerName,
    string? PhotographerSlug,
    int SortOrder
);

public static class PublicPhotoGalleryMapper
{
    // Editions are always loaded with .Include(...).ThenInclude(g => g.Photographer) by the time this
    // runs, so this is an in-memory projection over an already-materialized collection, not a query —
    // never call this before the Include has executed, or Photographer will silently read as null.
    public static List<PublicPhotoGalleryDto> ToPublicDtos(this IEnumerable<PhotoGallery> galleries) =>
        galleries
            .OrderBy(g => g.SortOrder)
            .Select(g => new PublicPhotoGalleryDto(
                g.Url,
                g.Title,
                g.TitleEn,
                g.Photographer?.Name,
                g.Photographer?.Slug,
                g.SortOrder
            ))
            .ToList();
}

using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Photographers;

// One gallery, with just enough of its event/edition to link and sort — mirrors
// OrganizerEventSummaryDto's role for the organizer public page.
public record PhotographerGalleryEntryDto(
    Guid EventId,
    string EventName,
    string? EventNameEn,
    string EventSlug,
    Guid EditionId,
    int? EditionYear,
    DateOnly? EditionDate,
    string GalleryUrl,
    string? GalleryTitle,
    string? GalleryTitleEn
);

// Narrowed public-facing projection of Photographer — deliberately withholds Id, Email,
// TranslationHashes, CreatedAt/UpdatedAt and any other admin-only field. See
// OrganizerPublicDto for the same pattern applied to organizers (both DTOs withhold Id;
// no public frontend caller needs one).
public record PhotographerPublicDto(
    string Name,
    string Slug,
    string? Website,
    string? Description,
    string? DescriptionEn,
    List<PhotographerGalleryEntryDto> Galleries,
    List<SocialLink>? SocialLinks = null
);

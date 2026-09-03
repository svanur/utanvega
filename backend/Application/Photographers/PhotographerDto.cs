using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Photographers;

public record PhotographerDto(
    Guid Id,
    string Name,
    string Slug,
    string? Website,
    string? Email,
    string? Description,
    string? DescriptionEn,
    int GalleryCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    Dictionary<string, string>? TranslationHashes = null,
    List<SocialLink>? SocialLinks = null
);

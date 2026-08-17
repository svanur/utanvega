namespace Utanvega.Backend.Application.Organizers;

public record OrganizerPublicDto(
    Guid Id,
    string Name,
    string Slug,
    string? Website,
    string? Description,
    string? DescriptionEn,
    string? ContactName
);

public record OrganizerDto(
    Guid Id,
    string Name,
    string Slug,
    string? Kennitala,
    string? Phone,
    string? Email,
    string? Website,
    string? Description,
    string? DescriptionEn,
    string? ContactName,
    int EventCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    Dictionary<string, string>? TranslationHashes = null
);

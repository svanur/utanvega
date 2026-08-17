namespace Utanvega.Backend.Application.Organizers;

public record OrganizerEventSummaryDto(
    Guid Id,
    string Name,
    string? NameEn,
    string Slug,
    string? Description,
    string? DescriptionEn,
    string ActivityType,
    DateOnly? NextEditionDate,
    DateOnly? EndDisplayDate
);

public record OrganizerPublicDto(
    Guid Id,
    string Name,
    string Slug,
    string? Website,
    string? Description,
    string? DescriptionEn,
    string? ContactName,
    List<OrganizerEventSummaryDto> Events
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

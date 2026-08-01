namespace Utanvega.Backend.Application.Organizers;

public record OrganizerPublicDto(
    Guid Id,
    string Name,
    string? Website
);

public record OrganizerDto(
    Guid Id,
    string Name,
    string? Kennitala,
    string? Phone,
    string? Email,
    string? Website,
    string? Description,
    string? DescriptionEn,
    string? ContactName,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

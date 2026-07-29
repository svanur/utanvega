namespace Utanvega.Backend.Application.Organizers;

public record OrganizerDto(
    Guid Id,
    string Name,
    string? Kennitala,
    string? Phone,
    string? Email,
    string? Website,
    string? Description,
    string? ContactName,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

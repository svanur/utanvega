namespace Utanvega.Backend.Application.Tags;

public record TagDto(
    Guid Id,
    string Name,
    string? NameEn,
    string Slug,
    string? Color,
    int TrailCount,
    string? TranslationHashes
);

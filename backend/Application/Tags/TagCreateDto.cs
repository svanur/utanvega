namespace Utanvega.Backend.Application.Tags;

public record TagCreateDto(string Name, string? Color, string? NameEn = null, Dictionary<string, string>? TranslationHashes = null, string? Slug = null);

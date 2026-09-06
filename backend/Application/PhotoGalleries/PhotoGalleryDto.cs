namespace Utanvega.Backend.Application.PhotoGalleries;

public record PhotoGalleryDto(
    Guid Id,
    Guid EventEditionId,
    string Url,
    Guid? PhotographerId,
    string? PhotographerName,
    string? Title,
    string? TitleEn,
    int SortOrder,
    DateTime CreatedAt,
    string? CreatedBy
);

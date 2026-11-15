namespace Utanvega.Backend.Application.Locations.Queries.GetLocations;

using Utanvega.Backend.Core.Entities;

public record LocationDto(
    Guid Id,
    string Name,
    string? NameEn,
    string Slug,
    string? Description,
    string? DescriptionEn,
    string Type,
    Guid? ParentId,
    string? ParentName,
    string? ParentNameEn,
    double? Latitude,
    double? Longitude,
    double? Radius,
    int ChildrenCount,
    int TrailsCount,
    Dictionary<string, string>? TranslationHashes = null,
    // #1707: GeoJSON Polygon, converted from Location.Boundary (#1705) when present, so the
    // public detail page can render the municipality outline. Null for the vast majority of
    // locations that don't have a saved boundary yet.
    string? BoundaryGeoJson = null
);

namespace Utanvega.Backend.Application.Locations.Queries.GetLocations;

using Utanvega.Backend.Core.Entities;

public record LocationDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string Type,
    Guid? ParentId,
    string? ParentName,
    double? Latitude,
    double? Longitude,
    double? Radius,
    int ChildrenCount
);

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;
using Utanvega.Backend.Application.Locations.Queries.GetLocations;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;
using NetTopologySuite.Geometries;

namespace Utanvega.Backend.Application.Locations.Queries.GetLocationBySlug;

public record LocationWithTrailsDto(
    LocationDto Location,
    List<TrailDto> Trails
);

public record GetLocationBySlugQuery(string Slug) : IRequest<LocationWithTrailsDto?>;

public class GetLocationBySlugQueryHandler : IRequestHandler<GetLocationBySlugQuery, LocationWithTrailsDto?>
{
    private readonly UtanvegaDbContext _context;

    public GetLocationBySlugQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<LocationWithTrailsDto?> Handle(GetLocationBySlugQuery request, CancellationToken cancellationToken)
    {
        var location = await _context.Locations
            .Include(l => l.Parent)
            .Include(l => l.Children)
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Slug == request.Slug, cancellationToken);

        if (location == null) return null;

        var locationDto = new LocationDto(
            location.Id,
            location.Name,
            location.Slug,
            location.Description,
            location.Type.ToString(),
            location.ParentId,
            location.Parent?.Name,
            location.Center?.Y,
            location.Center?.X,
            location.Radius,
            location.Children.Count,
            _context.TrailLocations.Count(tl => tl.LocationId == location.Id)
        );

        var trails = await _context.Trails
            .Include(t => t.TrailLocations)
                .ThenInclude(tl => tl.Location)
            .Where(t => t.Status == TrailStatus.Published && t.TrailLocations.Any(tl => tl.LocationId == location.Id))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var trailDtos = trails.Select(t => new TrailDto(
            t.Id,
            t.Name,
            t.Slug,
            t.Description,
            t.Length,
            t.ElevationGain,
            t.ElevationLoss,
            t.Status.ToString(),
            t.ActivityTypeId.ToString(),
            t.Type.ToString(),
            t.Difficulty.ToString(),
            (t.GpxData as LineString)?.StartPoint.Y,
            (t.GpxData as LineString)?.StartPoint.X,
            t.TrailLocations
                .OrderBy(tl => tl.Order)
                .Select(tl => new LocationInfoDto(tl.Location.Name, tl.Location.Slug, tl.Order))
                .ToList()
        )).ToList();

        return new LocationWithTrailsDto(locationDto, trailDtos);
    }
}

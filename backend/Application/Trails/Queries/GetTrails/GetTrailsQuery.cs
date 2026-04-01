using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrails;

public record GetTrailsQuery(bool IncludeDeleted = false, bool PublishedOnly = false) : IRequest<List<TrailDto>>;

public record LocationInfoDto(string Name, string Slug, int Order);

public record TrailDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    double Length,
    double ElevationGain,
    double ElevationLoss,
    string Status,
    string ActivityType,
    string TrailType,
    string Difficulty,
    double? StartLatitude,
    double? StartLongitude,
    List<LocationInfoDto> Locations
);

public class GetTrailsQueryHandler : IRequestHandler<GetTrailsQuery, List<TrailDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<TrailDto>> Handle(GetTrailsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Trails
            .Include(t => t.TrailLocations)
                .ThenInclude(tl => tl.Location)
            .AsQueryable();

        if (!request.IncludeDeleted)
        {
            query = query.Where(t => t.Status != TrailStatus.Deleted);
        }

        if (request.PublishedOnly)
        {
            query = query.Where(t => t.Status == TrailStatus.Published);
        }

        var trails = await query.ToListAsync(cancellationToken);

        var result = trails.Select(t => new TrailDto(
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

        return result;
    }
}

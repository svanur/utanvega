using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailBySlug;

public record GetTrailBySlugQuery(string Slug) : IRequest<TrailDto?>;

public class GetTrailBySlugQueryHandler : IRequestHandler<GetTrailBySlugQuery, TrailDto?>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailBySlugQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<TrailDto?> Handle(GetTrailBySlugQuery request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == request.Slug && t.Status == TrailStatus.Published, cancellationToken);

        if (trail == null) return null;

        return new TrailDto(
            trail.Id,
            trail.Name,
            trail.Slug,
            trail.Length,
            trail.ElevationGain,
            trail.ElevationLoss,
            trail.Status.ToString(),
            trail.ActivityTypeId.ToString(),
            (trail.GpxData as LineString)?.StartPoint.Y,
            (trail.GpxData as LineString)?.StartPoint.X
        );
    }
}

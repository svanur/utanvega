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
            .Include(t => t.TrailLocations)
                .ThenInclude(tl => tl.Location)
            .Include(t => t.TrailTags)
                .ThenInclude(tt => tt.Tag)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == request.Slug && t.Status == TrailStatus.Published, cancellationToken);

        if (trail == null)
        {
            Console.WriteLine($"[DEBUG_LOG] Trail with slug '{request.Slug}' not found or not published.");
            return null;
        }

        Console.WriteLine($"[DEBUG_LOG] Trail found: {trail.Name}. Gain: {trail.ElevationGain}, Length: {trail.Length}");

        return new TrailDto(
            trail.Id,
            trail.Name,
            trail.Slug,
            trail.Description,
            trail.Length,
            trail.ElevationGain,
            trail.ElevationLoss,
            trail.Status.ToString(),
            trail.ActivityTypeId.ToString(),
            trail.Type.ToString(),
            trail.Difficulty.ToString(),
            (trail.GpxData as LineString)?.StartPoint.Y,
            (trail.GpxData as LineString)?.StartPoint.X,
            trail.TrailLocations
                .OrderBy(tl => tl.Order)
                .Select(tl => new LocationInfoDto(tl.Location.Name, tl.Location.Slug, tl.Order))
                .ToList(),
            trail.TrailTags
                .Select(tt => new TagInfoDto(tt.Tag.Name, tt.Tag.Slug, tt.Tag.Color))
                .ToList()
        );
    }
}

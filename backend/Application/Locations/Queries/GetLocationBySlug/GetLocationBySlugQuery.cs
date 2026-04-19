using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;
using Utanvega.Backend.Application.Locations.Queries.GetLocations;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;
using NetTopologySuite.Geometries;

namespace Utanvega.Backend.Application.Locations.Queries.GetLocationBySlug;

public record LocationWithTrailsDto(
    LocationDto Location,
    List<LocationDto> ChildLocations,
    List<TrailDto> Trails
);

public record GetLocationBySlugQuery(string Slug) : IRequest<LocationWithTrailsDto?>, ICacheable
{
    public string CacheKey => CacheKeys.Location(Slug);
    public TimeSpan CacheDuration => TimeSpan.FromMinutes(45);
}

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

        // Build child location DTOs
        var childDtos = await _context.Locations
            .Where(l => l.ParentId == location.Id)
            .OrderBy(l => l.Name)
            .Select(l => new LocationDto(
                l.Id, l.Name, l.Slug, l.Description, l.Type.ToString(),
                l.ParentId, location.Name, l.Center != null ? l.Center.Y : null,
                l.Center != null ? l.Center.X : null, l.Radius,
                l.Children.Count, l.TrailLocations.Count))
            .ToListAsync(cancellationToken);

        // Collect all descendant location IDs for ancestor-aware trail query
        var allLocationIds = await CollectDescendantIds(location.Id, cancellationToken);
        allLocationIds.Add(location.Id);

        var trails = await _context.Trails
            .Include(t => t.TrailLocations)
                .ThenInclude(tl => tl.Location)
            .Include(t => t.TrailTags)
                .ThenInclude(tt => tt.Tag)
            .Where(t => t.Status == TrailStatus.Published
                && t.TrailLocations.Any(tl => allLocationIds.Contains(tl.LocationId)))
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
                .Select(tl => new LocationInfoDto(tl.LocationId, tl.Location.Name, tl.Location.Slug, tl.Order, tl.Role.ToString()))
                .ToList(),
            t.TrailTags
                .Select(tt => new TagInfoDto(tt.Tag.Name, tt.Tag.Slug, tt.Tag.Color))
                .ToList()
        )).ToList();

        return new LocationWithTrailsDto(locationDto, childDtos, trailDtos);
    }

    /// <summary>
    /// Recursively collect all descendant location IDs using BFS.
    /// </summary>
    private async Task<HashSet<Guid>> CollectDescendantIds(Guid parentId, CancellationToken ct)
    {
        var all = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(parentId);

        // Load the full parent→children map once
        var childrenMap = (await _context.Locations
            .AsNoTracking()
            .Where(l => l.ParentId != null)
            .Select(l => new { l.Id, ParentId = l.ParentId!.Value })
            .ToListAsync(ct))
            .GroupBy(l => l.ParentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (childrenMap.TryGetValue(current, out var children))
            {
                foreach (var childId in children)
                {
                    all.Add(childId);
                    queue.Enqueue(childId);
                }
            }
        }

        return all;
    }
}

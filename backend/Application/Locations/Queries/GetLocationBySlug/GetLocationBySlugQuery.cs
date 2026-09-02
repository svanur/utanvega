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
            .AsNoTracking()
            .Where(l => l.Slug == request.Slug)
            .Select(l => new
            {
                l.Id, l.Name, l.NameEn, l.Slug, l.Description, l.DescriptionEn, l.Type,
                l.ParentId, l.Radius,
                Latitude = l.Center != null ? (double?)l.Center.Y : null,
                Longitude = l.Center != null ? (double?)l.Center.X : null,
                ParentName = l.Parent != null ? l.Parent.Name : null,
                ParentNameEn = l.Parent != null ? l.Parent.NameEn : null,
                ChildrenCount = l.Children.Count,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (location == null) return null;

        var trailCount = await _context.TrailLocations.CountAsync(tl => tl.LocationId == location.Id, cancellationToken);

        var locationDto = new LocationDto(
            location.Id,
            location.Name,
            location.NameEn,
            location.Slug,
            location.Description,
            location.DescriptionEn,
            location.Type.ToString(),
            location.ParentId,
            location.ParentName,
            location.ParentNameEn,
            location.Latitude,
            location.Longitude,
            location.Radius,
            location.ChildrenCount,
            trailCount
        );

        // Build child location DTOs
        var childRaw = await _context.Locations
            .Where(l => l.ParentId == location.Id)
            .OrderBy(l => l.Name)
            .Select(l => new {
                l.Id, l.Name, l.NameEn, l.Slug, l.Description, l.DescriptionEn,
                Type = l.Type.ToString(), l.ParentId,
                Latitude = l.Center != null ? l.Center.Y : (double?)null,
                Longitude = l.Center != null ? l.Center.X : (double?)null,
                l.Radius,
                ChildrenCount = l.Children.Count,
                TrailsCount = l.TrailLocations.Count,
            })
            .ToListAsync(cancellationToken);
        var childDtos = childRaw.Select(l => new LocationDto(
            l.Id, l.Name, l.NameEn, l.Slug, l.Description, l.DescriptionEn,
            l.Type, l.ParentId, location.Name, location.NameEn, l.Latitude, l.Longitude, l.Radius,
            l.ChildrenCount, l.TrailsCount
        )).ToList();

        // Collect all descendant location IDs for ancestor-aware trail query
        var allLocationIds = await CollectDescendantIds(location.Id, cancellationToken);
        allLocationIds.Add(location.Id);

        var trailProjections = await _context.Trails
            .AsNoTracking()
            .Where(t => t.Status == TrailStatus.Published
                && t.TrailLocations.Any(tl => allLocationIds.Contains(tl.LocationId)))
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Slug,
                t.Description,
                t.Length,
                t.ElevationGain,
                t.ElevationLoss,
                t.Status,
                t.ActivityTypeId,
                t.Type,
                t.Difficulty,
                t.YoutubeUrl,
                t.CreatedAt,
                HasGpx = t.GpxData != null,
                Locations = t.TrailLocations
                    .OrderBy(tl => tl.Order)
                    .Select(tl => new LocationInfoDto(tl.LocationId, tl.Location.Name, tl.Location.NameEn, tl.Location.Slug, tl.Order, tl.Role.ToString(), tl.Location.Center != null ? (double?)tl.Location.Center.Y : null, tl.Location.Center != null ? (double?)tl.Location.Center.X : null))
                    .ToList(),
                Tags = t.TrailTags
                    .Select(tt => new TagInfoDto(tt.Tag.Name, tt.Tag.NameEn, tt.Tag.Slug, tt.Tag.Color))
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // GpxData typed as Geometry — can't cast to LineString in EF projection.
        // Load start points in a separate focused query and extract in memory.
        var gpxIds = trailProjections.Where(t => t.HasGpx).Select(t => t.Id).ToHashSet();
        var startCoords = gpxIds.Count > 0
            ? (await _context.Trails.AsNoTracking()
                .Where(t => gpxIds.Contains(t.Id) && t.GpxData != null)
                .Select(t => new { t.Id, t.GpxData })
                .ToListAsync(cancellationToken))
                .ToDictionary(t => t.Id, t => t.GpxData as LineString)
            : new Dictionary<Guid, LineString?>();

        var trailDtos = trailProjections.Select(t => new TrailDto(
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
            startCoords.TryGetValue(t.Id, out var ls) ? ls?.StartPoint.Y : null,
            startCoords.TryGetValue(t.Id, out var ls2) ? ls2?.StartPoint.X : null,
            t.Locations,
            t.Tags,
            YoutubeUrl: t.YoutubeUrl,
            CreatedAt: t.CreatedAt
        )).ToList();

        return new LocationWithTrailsDto(locationDto, childDtos, trailDtos);
    }

    private async Task<HashSet<Guid>> CollectDescendantIds(Guid parentId, CancellationToken ct)
    {
        var all = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(parentId);

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
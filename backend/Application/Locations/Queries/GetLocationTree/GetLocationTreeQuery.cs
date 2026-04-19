using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Queries.GetLocationTree;

public record LocationTreeNodeDto(
    Guid Id,
    string Name,
    string Slug,
    string Type,
    int TrailsCount,
    int TotalTrailsCount,
    List<LocationTreeNodeDto> Children
);

public record GetLocationTreeQuery : IRequest<List<LocationTreeNodeDto>>, ICacheable
{
    public string CacheKey => CacheKeys.LocationTree;
    public TimeSpan CacheDuration => TimeSpan.FromHours(2);
}

public class GetLocationTreeQueryHandler : IRequestHandler<GetLocationTreeQuery, List<LocationTreeNodeDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetLocationTreeQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<LocationTreeNodeDto>> Handle(GetLocationTreeQuery request, CancellationToken cancellationToken)
    {
        var locations = await _context.Locations
            .AsNoTracking()
            .Select(l => new
            {
                l.Id,
                l.Name,
                l.Slug,
                Type = l.Type.ToString(),
                l.ParentId,
                TrailsCount = l.TrailLocations.Count
            })
            .ToListAsync(cancellationToken);

        // Build lookup tables
        var byId = locations.ToDictionary(l => l.Id);
        var childrenOf = locations
            .Where(l => l.ParentId.HasValue)
            .GroupBy(l => l.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Recursive tree builder
        List<LocationTreeNodeDto> BuildChildren(Guid? parentId)
        {
            var children = parentId.HasValue
                ? (childrenOf.GetValueOrDefault(parentId.Value) ?? [])
                : locations.Where(l => l.ParentId == null).ToList();

            return children
                .OrderBy(c => c.Name)
                .Select(c =>
                {
                    var childNodes = BuildChildren(c.Id);
                    var totalTrails = c.TrailsCount + childNodes.Sum(n => n.TotalTrailsCount);
                    return new LocationTreeNodeDto(
                        c.Id, c.Name, c.Slug, c.Type,
                        c.TrailsCount, totalTrails, childNodes);
                })
                .ToList();
        }

        return BuildChildren(null);
    }
}

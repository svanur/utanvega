using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Queries.GetLocations;

public record GetLocationsQuery(Guid? ParentId = null, string? Search = null) : IRequest<List<LocationDto>>;

public class GetLocationsQueryHandler : IRequestHandler<GetLocationsQuery, List<LocationDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IMemoryCache _cache;

    public GetLocationsQueryHandler(UtanvegaDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<List<LocationDto>> Handle(GetLocationsQuery request, CancellationToken cancellationToken)
    {
        // Only cache the no-filter case (public list)
        var isCacheable = request.ParentId is null && string.IsNullOrWhiteSpace(request.Search);
        if (isCacheable && _cache.TryGetValue(CacheKeys.LocationsAll, out List<LocationDto>? cached) && cached is not null)
            return cached;
        var query = _context.Locations
            .AsNoTracking();

        if (request.ParentId.HasValue)
        {
            query = query.Where(l => l.ParentId == request.ParentId);
        }
        else if (string.IsNullOrWhiteSpace(request.Search))
        {
            // By default, if no search and no parent specified, show roots? 
            // Or show all? Let's show all for now for the admin table, 
            // but for hierarchy navigation we might want just roots.
            // query = query.Where(l => l.ParentId == null);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(l => l.Name.ToLower().Contains(search) || l.Slug.ToLower().Contains(search));
        }

        var result = await query
            .OrderBy(l => l.Name)
            .Select(l => new LocationDto(
                l.Id,
                l.Name,
                l.Slug,
                l.Description,
                l.Type.ToString(),
                l.ParentId,
                l.Parent != null ? l.Parent.Name : null,
                l.Center != null ? l.Center.Y : null,
                l.Center != null ? l.Center.X : null,
                l.Radius,
                l.Children.Count,
                l.TrailLocations.Count
            ))
            .ToListAsync(cancellationToken);

        if (isCacheable)
            _cache.Set(CacheKeys.LocationsAll, result, TimeSpan.FromHours(1));

        return result;
    }
}

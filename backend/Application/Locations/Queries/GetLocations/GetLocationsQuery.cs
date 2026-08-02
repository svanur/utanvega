using System.Text.Json;
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

        var raw = await query
            .OrderBy(l => l.Name)
            .Select(l => new {
                l.Id, l.Name, l.NameEn, l.Slug, l.Description, l.DescriptionEn,
                Type = l.Type.ToString(),
                l.ParentId,
                ParentName = l.Parent != null ? l.Parent.Name : null,
                ParentNameEn = l.Parent != null ? l.Parent.NameEn : null,
                Latitude = l.Center != null ? l.Center.Y : (double?)null,
                Longitude = l.Center != null ? l.Center.X : (double?)null,
                l.Radius,
                ChildrenCount = l.Children.Count,
                TrailsCount = l.TrailLocations.Count,
                l.TranslationHashes,
            })
            .ToListAsync(cancellationToken);

        var result = raw.Select(l => new LocationDto(
            l.Id, l.Name, l.NameEn, l.Slug, l.Description, l.DescriptionEn,
            l.Type, l.ParentId, l.ParentName, l.ParentNameEn, l.Latitude, l.Longitude, l.Radius,
            l.ChildrenCount, l.TrailsCount,
            l.TranslationHashes == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(l.TranslationHashes)
        )).ToList();

        if (isCacheable)
            _cache.Set(CacheKeys.LocationsAll, result, TimeSpan.FromHours(1));

        return result;
    }
}

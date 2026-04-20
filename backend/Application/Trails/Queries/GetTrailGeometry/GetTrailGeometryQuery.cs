using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;
using NetTopologySuite.Geometries;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;

// Not ICacheable — uses manual caching in the handler so the cache key is always
// slug-based (normalised) regardless of whether the query arrives by Id or Slug.
// This ensures CacheInvalidator.InvalidateTrail(slug) always evicts the right entry.
public record GetTrailGeometryQuery(Guid? Id = null, string? Slug = null) : IRequest<string?>;

public class GetTrailGeometryQueryHandler : IRequestHandler<GetTrailGeometryQuery, string?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IMemoryCache _cache;

    public GetTrailGeometryQueryHandler(UtanvegaDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<string?> Handle(GetTrailGeometryQuery request, CancellationToken cancellationToken)
    {
        // Resolve the canonical slug first so the cache key is always slug-based.
        string? slug;
        if (!string.IsNullOrEmpty(request.Slug))
        {
            slug = request.Slug;
        }
        else if (request.Id.HasValue)
        {
            slug = await _context.Trails.AsNoTracking()
                .Where(t => t.Id == request.Id.Value)
                .Select(t => t.Slug)
                .FirstOrDefaultAsync(cancellationToken);
        }
        else
        {
            return null;
        }

        if (slug is null) return null;

        var cacheKey = CacheKeys.Geometry(slug);
        if (_cache.TryGetValue(cacheKey, out string? cached))
            return cached;

        var geometry = await _context.Trails.AsNoTracking()
            .Where(t => t.Slug == slug)
            .Select(t => t.GpxData)
            .FirstOrDefaultAsync(cancellationToken);

        if (geometry == null) return null;

        var factory = new GeometryFactory(new PrecisionModel(), geometry.SRID);
        var settings = new Newtonsoft.Json.JsonSerializerSettings();
        settings.Converters.Add(new NetTopologySuite.IO.Converters.GeometryConverter(factory, 3));
        var serializer = Newtonsoft.Json.JsonSerializer.Create(settings);

        using var stringWriter = new StringWriter();
        serializer.Serialize(stringWriter, geometry);
        var result = stringWriter.ToString();

        _cache.Set(cacheKey, result, TimeSpan.FromHours(24));
        return result;
    }
}

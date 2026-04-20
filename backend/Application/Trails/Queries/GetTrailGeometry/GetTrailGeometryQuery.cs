using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;
using NetTopologySuite.Geometries;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;

public record GetTrailGeometryQuery(Guid? Id = null, string? Slug = null) : IRequest<string?>, ICacheable
{
    public string CacheKey => CacheKeys.Geometry(Slug ?? Id?.ToString() ?? "unknown");
    public TimeSpan CacheDuration => TimeSpan.FromHours(24);
}

public class GetTrailGeometryQueryHandler : IRequestHandler<GetTrailGeometryQuery, string?>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailGeometryQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<string?> Handle(GetTrailGeometryQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Trails.AsNoTracking();

        if (request.Id.HasValue)
        {
            query = query.Where(t => t.Id == request.Id.Value);
        }
        else if (!string.IsNullOrEmpty(request.Slug))
        {
            query = query.Where(t => t.Slug == request.Slug);
        }
        else
        {
            return null;
        }

        var geometry = await query
            .Select(t => t.GpxData)
            .FirstOrDefaultAsync(cancellationToken);

        if (geometry == null) return null;

        // Create a plain Newtonsoft serializer with ONLY a dimension-3 GeometryConverter.
        // GeoJsonSerializer.Create() adds its own dim-2 converter first, which shadows any
        // dim-3 converter added afterwards — so we avoid it entirely.
        var factory = new GeometryFactory(new PrecisionModel(), geometry.SRID);
        var settings = new Newtonsoft.Json.JsonSerializerSettings();
        settings.Converters.Add(new NetTopologySuite.IO.Converters.GeometryConverter(factory, 3));
        var serializer = Newtonsoft.Json.JsonSerializer.Create(settings);

        using var stringWriter = new StringWriter();
        serializer.Serialize(stringWriter, geometry);
        return stringWriter.ToString();
    }
}

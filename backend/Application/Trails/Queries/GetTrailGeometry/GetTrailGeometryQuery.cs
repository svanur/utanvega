using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;

public record GetTrailGeometryQuery(Guid? Id = null, string? Slug = null) : IRequest<string?>;

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

        // Using NetTopologySuite GeoJsonWriter (Basic version for simplicity)
        var writer = new NetTopologySuite.IO.GeoJsonWriter();
        return writer.Write(geometry);
    }
}

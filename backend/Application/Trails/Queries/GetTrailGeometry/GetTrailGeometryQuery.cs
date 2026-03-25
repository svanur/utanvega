using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;

public record GetTrailGeometryQuery(Guid Id) : IRequest<string?>;

public class GetTrailGeometryQueryHandler : IRequestHandler<GetTrailGeometryQuery, string?>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailGeometryQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<string?> Handle(GetTrailGeometryQuery request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .AsNoTracking()
            .Where(t => t.Id == request.Id)
            .Select(t => t.GpxData)
            .FirstOrDefaultAsync(cancellationToken);

        if (trail == null) return null;

        // Using NetTopologySuite GeoJsonWriter (Basic version for simplicity)
        var writer = new NetTopologySuite.IO.GeoJsonWriter();
        return writer.Write(trail);
    }
}

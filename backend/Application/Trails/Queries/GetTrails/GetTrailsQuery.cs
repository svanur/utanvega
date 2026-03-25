using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrails;

public record GetTrailsQuery() : IRequest<List<TrailDto>>;

public record TrailDto(
    Guid Id,
    string Name,
    string Slug,
    double Length,
    double ElevationGain,
    double ElevationLoss,
    string Status,
    string ActivityType
);

public class GetTrailsQueryHandler : IRequestHandler<GetTrailsQuery, List<TrailDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<TrailDto>> Handle(GetTrailsQuery request, CancellationToken cancellationToken)
    {
        return await _context.Trails
            .Select(t => new TrailDto(
                t.Id,
                t.Name,
                t.Slug,
                t.Length,
                t.ElevationGain,
                t.ElevationLoss,
                t.Status.ToString(),
                t.ActivityTypeId.ToString()
            ))
            .ToListAsync(cancellationToken);
    }
}

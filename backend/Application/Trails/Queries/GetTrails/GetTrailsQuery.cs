using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrails;

public record GetTrailsQuery(bool IncludeDeleted = false) : IRequest<List<TrailDto>>;

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
        var query = _context.Trails.AsQueryable();

        if (!request.IncludeDeleted)
        {
            query = query.Where(t => t.Status != TrailStatus.Deleted);
        }

        return await query
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

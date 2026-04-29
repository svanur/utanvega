using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailBySlug;

public record GetTrailBySlugQuery(string Slug) : IRequest<TrailDto?>, ICacheable
{
    public string CacheKey => CacheKeys.Trail(Slug);
    public TimeSpan CacheDuration => TimeSpan.FromMinutes(45);
}

public class GetTrailBySlugQueryHandler : IRequestHandler<GetTrailBySlugQuery, TrailDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetTrailBySlugQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<TrailDto?> Handle(GetTrailBySlugQuery request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .Include(t => t.TrailLocations)
                .ThenInclude(tl => tl.Location)
            .Include(t => t.TrailTags)
                .ThenInclude(tt => tt.Tag)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == request.Slug && (t.Status == TrailStatus.Published || t.Status == TrailStatus.RaceOnly), cancellationToken);

        if (trail == null)
            return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var linkedRaces = await _context.Races
            .Include(r => r.Competition)
            .AsNoTracking()
            .Where(r => r.TrailId == trail.Id && r.Status == RaceStatus.Active && r.Competition.Status == CompetitionStatus.Active)
            .Select(r => new { r.Name, r.DistanceLabel, r.Competition })
            .ToListAsync(cancellationToken);

        var linkedRaceDtos = linkedRaces
            .Select(r =>
            {
                var daysUntil = r.Competition.ScheduleRule != null
                    ? (_scheduleEngine.GetNextOccurrence(r.Competition.ScheduleRule, today) is { } next
                        ? next.DayNumber - today.DayNumber
                        : (int?)null)
                    : null;
                return new LinkedRaceDto(r.Competition.Name, r.Competition.Slug, r.Name, r.DistanceLabel, daysUntil);
            })
            .ToList();

        return new TrailDto(
            trail.Id,
            trail.Name,
            trail.Slug,
            trail.Description,
            trail.Length,
            trail.ElevationGain,
            trail.ElevationLoss,
            trail.Status.ToString(),
            trail.ActivityTypeId.ToString(),
            trail.Type.ToString(),
            trail.Difficulty.ToString(),
            (trail.GpxData as LineString)?.StartPoint.Y,
            (trail.GpxData as LineString)?.StartPoint.X,
            trail.TrailLocations
                .OrderBy(tl => tl.Order)
                .Select(tl => new LocationInfoDto(tl.LocationId, tl.Location.Name, tl.Location.Slug, tl.Order, tl.Role.ToString()))
                .ToList(),
            trail.TrailTags
                .Select(tt => new TagInfoDto(tt.Tag.Name, tt.Tag.Slug, tt.Tag.Color))
                .ToList(),
            LinkedRaces: linkedRaceDtos.Count > 0 ? linkedRaceDtos : null
        );
    }
}

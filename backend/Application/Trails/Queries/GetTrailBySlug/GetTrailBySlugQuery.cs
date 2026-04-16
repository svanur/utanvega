using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailBySlug;

public record GetTrailBySlugQuery(string Slug) : IRequest<TrailDto?>;

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
            .FirstOrDefaultAsync(t => t.Slug == request.Slug && t.Status == TrailStatus.Published, cancellationToken);

        if (trail == null)
        {
            Console.WriteLine($"[DEBUG_LOG] Trail with slug '{request.Slug}' not found or not published.");
            return null;
        }

        Console.WriteLine($"[DEBUG_LOG] Trail found: {trail.Name}. Gain: {trail.ElevationGain}, Length: {trail.Length}");

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

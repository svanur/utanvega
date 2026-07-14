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
            .FirstOrDefaultAsync(t => t.Slug == request.Slug && (t.Status == TrailStatus.Published || t.Status == TrailStatus.EventOnly), cancellationToken);

        if (trail == null)
            return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var linkedRaces = await _context.Races
            .Include(r => r.EventEdition)
                .ThenInclude(ed => ed.Event)
            .AsNoTracking()
            .Where(r => r.TrailId == trail.Id
                && r.Status != RaceStatus.Cancelled
                && r.Status != RaceStatus.Hidden
                && r.EventEdition.Event.Status != EventStatus.Cancelled
                && r.EventEdition.Event.Status != EventStatus.Hidden)
            .ToListAsync(cancellationToken);

        var linkedRaceDtos = linkedRaces
            .Select(r =>
            {
                int? daysUntil = null;
                if (r.EventEdition.Date.HasValue && r.EventEdition.Date.Value >= today)
                    daysUntil = r.EventEdition.Date.Value.DayNumber - today.DayNumber;
                else if (r.EventEdition.Event.ScheduleRule != null)
                    daysUntil = _scheduleEngine.GetDaysUntilNext(r.EventEdition.Event.ScheduleRule);

                return new LinkedRaceDto(
                    r.EventEdition.Event.Name,
                    r.EventEdition.Event.Slug,
                    r.Name,
                    r.DistanceLabel,
                    daysUntil,
                    r.StartTime.HasValue ? r.StartTime.Value.ToString("HH:mm") : null,
                    r.TicketStatus.ToString(),
                    r.ItraPoints);
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
                .Select(tl => new LocationInfoDto(tl.LocationId, tl.Location.Name, tl.Location.Slug, tl.Order, tl.Role.ToString(), tl.Location.Center?.Y, tl.Location.Center?.X))
                .ToList(),
            trail.TrailTags
                .Select(tt => new TagInfoDto(tt.Tag.Name, tt.Tag.Slug, tt.Tag.Color))
                .ToList(),
            LinkedRaces: linkedRaceDtos.Count > 0 ? linkedRaceDtos : null,
            YoutubeUrl: trail.YoutubeUrl,
            ElevationProfile: trail.ElevationProfile
        );
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEvents;

public record GetEventsQuery(bool IncludeHidden = false) : IRequest<List<EventSummaryDto>>, ICacheable
{
    public string CacheKey => CacheKeys.Events(IncludeHidden);
    public TimeSpan CacheDuration => TimeSpan.FromHours(1);
}

public class GetEventsQueryHandler : IRequestHandler<GetEventsQuery, List<EventSummaryDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetEventsQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<List<EventSummaryDto>> Handle(GetEventsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Events
            .AsNoTracking()
            .Include(e => e.Location)
            .Include(e => e.Editions)
            .AsQueryable();

        if (!request.IncludeHidden)
            query = query.Where(e => e.Status != EventStatus.Hidden && e.Status != EventStatus.Unlisted);

        var events = await query
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return events.Select(e =>
        {
            var nextDate = ResolveNextDate(e, today);
            int? daysUntil;
            if (nextDate.HasValue)
            {
                daysUntil = nextDate.Value.DayNumber - today.DayNumber;
            }
            else
            {
                var mostRecentPast = e.Editions
                    .Where(ed => ed.Date.HasValue && ed.Date.Value < today)
                    .OrderByDescending(ed => ed.Date)
                    .Select(ed => ed.Date)
                    .FirstOrDefault();

                daysUntil = mostRecentPast.HasValue && (today.DayNumber - mostRecentPast.Value.DayNumber) <= 3
                    ? mostRecentPast.Value.DayNumber - today.DayNumber
                    : null;
            }

            return new EventSummaryDto(
                e.Id,
                e.Name,
                e.Slug,
                e.Description,
                e.Type.ToString(),
                e.ActivityType.ToString(),
                e.Status.ToString(),
                e.OrganizerName,
                e.OrganizerWebsite,
                e.AlertMessage,
                e.AlertSeverity,
                e.LocationId,
                e.Location?.Name,
                e.ScheduleRule,
                e.SocialLinks,
                nextDate,
                daysUntil,
                e.Editions.Count,
                e.CreatedAt,
                e.UpdatedAt
            );
        }).ToList();
    }

    private DateOnly? ResolveNextDate(Core.Entities.Event e, DateOnly today)
    {
        var nextEditionDate = e.Editions
            .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
            .OrderBy(ed => ed.Date)
            .Select(ed => ed.Date)
            .FirstOrDefault();

        if (nextEditionDate.HasValue)
            return nextEditionDate;

        return e.ScheduleRule != null
            ? _scheduleEngine.GetNextOccurrence(e.ScheduleRule, today)
            : null;
    }
}

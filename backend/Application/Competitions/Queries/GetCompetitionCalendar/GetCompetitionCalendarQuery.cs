using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Queries.GetCompetitionCalendar;

public record CalendarEventDto(
    string Name,
    string Slug,
    string? LocationName,
    int RaceCount
);

public record CalendarDayDto(
    DateOnly Date,
    List<CalendarEventDto> Events
);

public record GetCompetitionCalendarQuery(DateOnly From, DateOnly To) : IRequest<List<CalendarDayDto>>, ICacheable
{
    public string CacheKey => CacheKeys.Calendar(From, To);
    public TimeSpan CacheDuration => TimeSpan.FromHours(2);
}

public class GetCompetitionCalendarQueryHandler : IRequestHandler<GetCompetitionCalendarQuery, List<CalendarDayDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetCompetitionCalendarQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<List<CalendarDayDto>> Handle(GetCompetitionCalendarQuery request, CancellationToken cancellationToken)
    {
        var competitions = await _context.Competitions
            .AsNoTracking()
            .Include(c => c.Location)
            .Include(c => c.Races)
            .Where(c => c.Status == Core.Entities.CompetitionStatus.Active)
            .ToListAsync(cancellationToken);

        var dayMap = new Dictionary<DateOnly, List<CalendarEventDto>>();

        foreach (var c in competitions)
        {
            if (c.ScheduleRule is null) continue;

            var occurrences = _scheduleEngine.GetOccurrencesInRange(c.ScheduleRule, request.From, request.To);
            foreach (var date in occurrences)
            {
                if (!dayMap.TryGetValue(date, out var events))
                {
                    events = [];
                    dayMap[date] = events;
                }
                events.Add(new CalendarEventDto(c.Name, c.Slug, c.Location?.Name, c.Races.Count));
            }
        }

        return dayMap
            .OrderBy(kv => kv.Key)
            .Select(kv => new CalendarDayDto(kv.Key, kv.Value))
            .ToList();
    }
}

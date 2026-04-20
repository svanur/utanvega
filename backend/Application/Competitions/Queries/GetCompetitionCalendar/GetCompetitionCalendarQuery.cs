using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
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

// Not ICacheable — uses manual versioned caching in the handler to allow
// full calendar invalidation without key enumeration.
public record GetCompetitionCalendarQuery(DateOnly From, DateOnly To) : IRequest<List<CalendarDayDto>>;

public class GetCompetitionCalendarQueryHandler : IRequestHandler<GetCompetitionCalendarQuery, List<CalendarDayDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;
    private readonly IMemoryCache _cache;

    public GetCompetitionCalendarQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine, IMemoryCache cache)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
        _cache = cache;
    }

    public async Task<List<CalendarDayDto>> Handle(GetCompetitionCalendarQuery request, CancellationToken cancellationToken)
    {
        var version = _cache.GetOrCreate(CacheKeys.CompetitionVersion, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });
        var cacheKey = CacheKeys.Calendar(version, request.From, request.To);

        if (_cache.TryGetValue(cacheKey, out List<CalendarDayDto>? cached) && cached is not null)
            return cached;

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

        var result = dayMap
            .OrderBy(kv => kv.Key)
            .Select(kv => new CalendarDayDto(kv.Key, kv.Value))
            .ToList();

        _cache.Set(cacheKey, result, TimeSpan.FromHours(2));
        return result;
    }
}

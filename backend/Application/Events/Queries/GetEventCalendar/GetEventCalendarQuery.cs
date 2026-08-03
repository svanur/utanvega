using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEventCalendar;

public record CalendarEventDto(
    string Name,
    string? NameEn,
    string Slug,
    string? LocationName,
    string? EditionTitle,
    int RaceCount,
    string Type
);

public record CalendarDayDto(
    DateOnly Date,
    List<CalendarEventDto> Events
);

// Not ICacheable — uses manual versioned caching to allow full invalidation without key enumeration.
public record GetEventCalendarQuery(DateOnly From, DateOnly To) : IRequest<List<CalendarDayDto>>;

public class GetEventCalendarQueryHandler : IRequestHandler<GetEventCalendarQuery, List<CalendarDayDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IMemoryCache _cache;

    public GetEventCalendarQueryHandler(UtanvegaDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<List<CalendarDayDto>> Handle(GetEventCalendarQuery request, CancellationToken cancellationToken)
    {
        var version = _cache.GetOrCreate(CacheKeys.EventVersion, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });
        var cacheKey = CacheKeys.Calendar(version, request.From, request.To);

        if (_cache.TryGetValue(cacheKey, out List<CalendarDayDto>? cached) && cached is not null)
            return cached;

        var editions = await _context.EventEditions
            .AsNoTracking()
            .Include(ed => ed.Event)
                .ThenInclude(ev => ev.Location)
            .Include(ed => ed.Races)
            .Where(ed =>
                ed.Date.HasValue &&
                ed.Date <= request.To &&
                (ed.EndDate.HasValue ? ed.EndDate >= request.From : ed.Date >= request.From) &&
                ed.Event.Status != EventStatus.Hidden &&
                ed.Event.Status != EventStatus.Unlisted)
            .ToListAsync(cancellationToken);

        var dayMap = new Dictionary<DateOnly, List<CalendarEventDto>>();

        foreach (var ed in editions)
        {
            var startDate = ed.Date!.Value;
            var endDate = ed.EndDate ?? startDate;
            var dto = new CalendarEventDto(
                ed.Event.Name,
                ed.Event.NameEn,
                ed.Event.Slug,
                ed.Event.Location?.Name,
                ed.Title,
                ed.Races.Count,
                ed.Event.Type.ToString()
            );

            for (var day = startDate; day <= endDate; day = day.AddDays(1))
            {
                if (day < request.From || day > request.To) continue;
                if (!dayMap.TryGetValue(day, out var events))
                {
                    events = [];
                    dayMap[day] = events;
                }
                events.Add(dto);
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

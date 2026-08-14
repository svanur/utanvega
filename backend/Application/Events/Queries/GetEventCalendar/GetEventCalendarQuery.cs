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
    string Type,
    List<string>? ActivityTypes = null,
    string? RaceName = null,
    List<string>? Distances = null,
    bool EffectiveCancelled = false
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
            .AsSplitQuery()
            .Include(ed => ed.Event)
                .ThenInclude(ev => ev.Location)
            .Include(ed => ed.Races)
                .ThenInclude(r => r.Trail)
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
            var allRaces = ed.Races.Where(r => r.Status != RaceStatus.Hidden).ToList();
            var activeRaces = allRaces.Where(r => r.Status != RaceStatus.Cancelled).ToList();
            var effectiveCancelled = ed.Event.Status == EventStatus.Cancelled
                || EditionStatusHelpers.ComputeEffectiveCancelled(ed.Status, allRaces.Select(r => r.Status).ToList());
            var activityTypes = activeRaces
                .Select(r => r.ActivityType?.ToString() ?? r.Trail?.ActivityTypeId.ToString())
                .Where(a => a != null)
                .Distinct()
                .OrderBy(a => a)
                .Cast<string>()
                .ToList();

            // Series events: emit one entry per race on its own date
            if (ed.Event.Type == EventType.Series)
            {
                var racesWithDate = activeRaces.Where(r => r.DateOfRace.HasValue).OrderBy(r => r.DateOfRace).ToList();
                foreach (var race in racesWithDate)
                {
                    var day = race.DateOfRace!.Value;
                    if (day < request.From || day > request.To) continue;
                    if (!dayMap.TryGetValue(day, out var raceEvents))
                    {
                        raceEvents = [];
                        dayMap[day] = raceEvents;
                    }
                    raceEvents.Add(new CalendarEventDto(
                        ed.Event.Name,
                        ed.Event.NameEn,
                        ed.Event.Slug,
                        ed.Event.Location?.Name,
                        ed.Title,
                        1,
                        ed.Event.Type.ToString(),
                        activityTypes.Count > 0 ? activityTypes : null,
                        race.Name,
                        EffectiveCancelled: effectiveCancelled
                    ));
                }
                continue;
            }

            var startDate = ed.Date!.Value;
            var endDate = ed.EndDate ?? startDate;
            var distances = activeRaces
                .OrderBy(r => r.SortOrder)
                .Where(r => r.DistanceLabel != null)
                .Select(r => r.DistanceLabel!)
                .ToList();

            var dto = new CalendarEventDto(
                ed.Event.Name,
                ed.Event.NameEn,
                ed.Event.Slug,
                ed.Event.Location?.Name,
                ed.Title,
                activeRaces.Count,
                ed.Event.Type.ToString(),
                activityTypes.Count > 0 ? activityTypes : null,
                Distances: distances.Count > 0 ? distances : null,
                EffectiveCancelled: effectiveCancelled
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

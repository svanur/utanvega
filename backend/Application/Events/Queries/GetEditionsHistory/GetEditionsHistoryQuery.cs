using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEditionsHistory;

public record EditionHistoryRowDto(
    Guid EventId,
    string EventSlug,
    string EventName,
    string? EventNameEn,
    string EventType,
    Guid EditionId,
    int? EditionYear,
    DateOnly RowDate,
    DateOnly? RowEndDate,
    string? LocationName,
    bool EffectiveCancelled,
    List<RaceDistanceSummaryDto> Distances,
    string? ResultsUrl,
    List<string>? ActivityTypes,
    string EventActivityType,
    Guid? RaceId,
    string? RaceName,
    string? RaceNameEn
);

// Not ICacheable — the key is parameterized by an arbitrary year, same reasoning as GetEventCalendarQuery
// (can't enumerate/remove "the" key for every possible year on a write, so it's version-tagged instead).
public record GetEditionsHistoryQuery(int Year, bool IncludeCancelled = true) : IRequest<List<EditionHistoryRowDto>>;

public class GetEditionsHistoryQueryHandler : IRequestHandler<GetEditionsHistoryQuery, List<EditionHistoryRowDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IMemoryCache _cache;

    public GetEditionsHistoryQueryHandler(UtanvegaDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<List<EditionHistoryRowDto>> Handle(GetEditionsHistoryQuery request, CancellationToken cancellationToken)
    {
        var version = _cache.GetOrCreate(CacheKeys.EventVersion, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });
        var cacheKey = CacheKeys.EditionsHistory(version, request.Year, request.IncludeCancelled);

        if (_cache.TryGetValue(cacheKey, out List<EditionHistoryRowDto>? cached) && cached is not null)
            return cached;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // Range comparison, not .Year extraction — .Year doesn't translate through the DateOnly-to-int
        // conversion SQLite needs (see TestDbContext), and range comparison is portable regardless.
        var yearStart = new DateOnly(request.Year, 1, 1);
        var yearEnd = new DateOnly(request.Year, 12, 31);

        var editions = await _context.EventEditions
            .AsNoTracking()
            .AsSplitQuery()
            .Include(ed => ed.Event)
                .ThenInclude(ev => ev.Location)
            .Include(ed => ed.Races)
                .ThenInclude(r => r.Trail)
            .Where(ed =>
                ed.Status != EditionStatus.Hidden &&
                ed.Event.Status != EventStatus.Hidden &&
                ed.Event.Status != EventStatus.Unlisted &&
                ((ed.Date.HasValue && ed.Date.Value >= yearStart && ed.Date.Value <= yearEnd) ||
                 (!ed.Date.HasValue && ed.Year == request.Year)))
            .ToListAsync(cancellationToken);

        var rows = new List<EditionHistoryRowDto>();

        foreach (var ed in editions)
        {
            // Past cutoff: dated editions must have actually concluded; dateless editions are only
            // treated as past once their whole Year is behind us — this year's dateless editions
            // haven't identifiably "happened" yet, so they're excluded rather than guessed at.
            var effectiveEnd = ed.EndDate ?? ed.Date;
            var isPast = effectiveEnd.HasValue ? effectiveEnd.Value < today : request.Year < today.Year;
            if (!isPast) continue;

            var visibleRaces = ed.Races.Where(r => r.Status != RaceStatus.Hidden).ToList();

            if (ed.Event.Type == EventType.Series)
            {
                // Series legs each get their own row — they have their own DateOfRace spread across
                // months, and their own individual cancelled state, distinct from the edition rollup.
                foreach (var race in visibleRaces.Where(r => r.DateOfRace.HasValue))
                {
                    var raceCancelled = race.Status == RaceStatus.Cancelled;
                    if (raceCancelled && !request.IncludeCancelled) continue;
                    rows.Add(BuildRow(ed, race.DateOfRace!.Value, [race], raceCancelled, raceId: race.Id, raceName: race.Name, raceNameEn: race.NameEn));
                }
            }
            else
            {
                var raceStatuses = ed.Races.Select(r => r.Status).ToList();
                var editionCancelled = EditionStatusHelpers.ComputeEffectiveCancelled(ed.Status, raceStatuses);
                if (editionCancelled && !request.IncludeCancelled) continue;
                var rowDate = ed.Date ?? effectiveEnd ?? new DateOnly(request.Year, 1, 1);
                rows.Add(BuildRow(ed, rowDate, visibleRaces, editionCancelled, ed.EndDate));
            }
        }

        var result = rows.OrderByDescending(r => r.RowDate).ToList();
        _cache.Set(cacheKey, result, TimeSpan.FromHours(12));
        return result;
    }

    private static EditionHistoryRowDto BuildRow(EventEdition ed, DateOnly rowDate, List<Race> races, bool effectiveCancelled, DateOnly? rowEndDate = null, Guid? raceId = null, string? raceName = null, string? raceNameEn = null)
    {
        var distances = races
            .Select(r =>
            {
                var label = !string.IsNullOrWhiteSpace(r.DistanceLabel)
                    ? r.DistanceLabel
                    : r.Trail != null && r.Trail.Length > 0
                        ? $"{r.Trail.Length / 1000.0:0.#} km"
                        : null;
                return label != null ? new RaceDistanceSummaryDto(label, r.TicketStatus.ToString()) : null;
            })
            .Where(d => d != null)
            .Cast<RaceDistanceSummaryDto>()
            .ToList();

        var activityTypes = races
            .Select(r => r.ActivityType?.ToString() ?? r.Trail?.ActivityTypeId.ToString())
            .Where(a => a != null)
            .Distinct()
            .OrderBy(a => a)
            .Cast<string>()
            .ToList();

        return new EditionHistoryRowDto(
            ed.Event.Id,
            ed.Event.Slug,
            ed.Event.Name,
            ed.Event.NameEn,
            ed.Event.Type.ToString(),
            ed.Id,
            ed.Year ?? ed.Date?.Year,
            rowDate,
            rowEndDate,
            ed.Event.Location?.Name,
            effectiveCancelled,
            distances,
            ed.ResultsUrl,
            activityTypes.Count > 0 ? activityTypes : null,
            ed.Event.ActivityType.ToString(),
            raceId,
            raceName,
            raceNameEn
        );
    }
}

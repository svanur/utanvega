using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;

public record GenerateEditionsResult(List<Guid> EditionIds, int RacesCreated);

public record GenerateEditionsForSeasonCommand(
    Guid EventId,
    DateOnly From,
    DateOnly To,
    Guid? TrailId = null,
    string? RegistrationUrl = null,
    int? SeasonStartMonth = null,
    string? EditionName = null
) : IRequest<GenerateEditionsResult>;

public class GenerateEditionsForSeasonCommandHandler : IRequestHandler<GenerateEditionsForSeasonCommand, GenerateEditionsResult>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;
    private readonly ICacheInvalidator _cacheInvalidator;

    public GenerateEditionsForSeasonCommandHandler(
        UtanvegaDbContext context,
        IScheduleRuleEngine scheduleEngine,
        ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<GenerateEditionsResult> Handle(GenerateEditionsForSeasonCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (ev?.ScheduleRule == null)
            return new GenerateEditionsResult([], 0);

        var dates = _scheduleEngine.GetOccurrencesInRange(ev.ScheduleRule, request.From, request.To);

        if (ev.Type == EventType.Series)
            return await HandleSeries(ev, dates, request, cancellationToken);

        return await HandleStandard(ev, dates, request, cancellationToken);
    }

    private async Task<GenerateEditionsResult> HandleStandard(Event ev, List<DateOnly> dates, GenerateEditionsForSeasonCommand request, CancellationToken cancellationToken)
    {
        var existingEditions = await _context.EventEditions
            .Where(ed => ed.EventId == ev.Id && ed.Date >= request.From && ed.Date <= request.To)
            .ToListAsync(cancellationToken);

        var existingDateSet = existingEditions
            .Where(ed => ed.Date.HasValue)
            .Select(ed => ed.Date!.Value)
            .ToHashSet();

        var newDates = dates.Where(d => !existingDateSet.Contains(d)).ToList();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var editions = newDates.Select((date, index) => new EventEdition
        {
            EventId = ev.Id,
            Date = date,
            Year = date.Year,
            Title = $"Hlaup {index + 1}",
            TrailId = request.TrailId,
            RegistrationUrl = request.RegistrationUrl,
            RegistrationStatus = RegistrationStatus.NotStarted,
            Status = EditionStatus.Unconfirmed,
            CreatedAt = DateTime.UtcNow,
        }).ToList();

        // No races are attached to these editions in this code path, so completing an
        // already-past edition is just a status/registration flip via CompleteWithRaces()
        // (a no-op over its empty Races collection) — kept consistent with CreateEditionCommand.
        foreach (var edition in editions.Where(e => e.Date.HasValue && e.Date.Value < today))
            edition.CompleteWithRaces();

        _context.EventEditions.AddRange(editions);

        if (request.TrailId.HasValue || !string.IsNullOrWhiteSpace(request.RegistrationUrl))
        {
            foreach (var ed in existingEditions)
            {
                if (request.TrailId.HasValue && ed.TrailId == null)
                    ed.TrailId = request.TrailId;
                if (!string.IsNullOrWhiteSpace(request.RegistrationUrl) && string.IsNullOrWhiteSpace(ed.RegistrationUrl))
                    ed.RegistrationUrl = request.RegistrationUrl;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(ev.Slug);

        return new GenerateEditionsResult(editions.Select(e => e.Id).ToList(), 0);
    }

    private async Task<GenerateEditionsResult> HandleSeries(Event ev, List<DateOnly> dates, GenerateEditionsForSeasonCommand request, CancellationToken cancellationToken)
    {
        var seasonStartMonth = request.SeasonStartMonth
            ?? ev.ScheduleRule!.MonthStart
            ?? 1;

        // Load all existing race dates for this event to deduplicate
        var existingRaceDates = await _context.Races
            .Where(r => r.EventEdition.EventId == ev.Id && r.DateOfRace.HasValue)
            .Select(r => r.DateOfRace!.Value)
            .ToListAsync(cancellationToken);
        var existingRaceDateSet = existingRaceDates.ToHashSet();

        var newDates = dates.Where(d => !existingRaceDateSet.Contains(d)).ToList();
        if (newDates.Count == 0)
        {
            return new GenerateEditionsResult([], 0);
        }

        // Group dates by season
        var seasonGroups = newDates
            .GroupBy(d => GetSeasonYear(d, seasonStartMonth))
            .OrderBy(g => g.Key)
            .ToList();

        var createdEditionIds = new List<Guid>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Load any editions already covering these seasons up front, instead of one query per group below.
        // GroupBy then First() guards against the rare case of duplicate Year values for the same event
        // (ToDictionaryAsync would throw ArgumentException on duplicate keys).
        var seasonYears = seasonGroups.Select(g => g.Key).ToList();
        var existingEditionsByYear = (await _context.EventEditions
            .Include(ed => ed.Races)
            .Where(ed => ed.EventId == ev.Id && ed.Year != null && seasonYears.Contains(ed.Year.Value))
            .ToListAsync(cancellationToken))
            .GroupBy(ed => ed.Year!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var group in seasonGroups)
        {
            var seasonYear = group.Key;
            var seasonDates = group.OrderBy(d => d).ToList();
            var firstDate = seasonDates[0];

            // Determine season title: use custom name if provided, otherwise "2025–2026" or "2025"
            var lastDate = seasonDates[^1];
            string title;
            if (!string.IsNullOrWhiteSpace(request.EditionName))
            {
                var yearSuffix = firstDate.Year != lastDate.Year
                    ? $"{seasonYear}–{seasonYear + 1}"
                    : $"{seasonYear}";
                title = $"{request.EditionName} {yearSuffix}";
            }
            else
            {
                title = firstDate.Year != lastDate.Year
                    ? $"{seasonYear}–{seasonYear + 1}"
                    : $"{seasonYear}";
            }

            // Check if an edition for this season already exists
            EventEdition edition;
            var isNewEdition = !existingEditionsByYear.TryGetValue(seasonYear, out var existingEdition);
            if (isNewEdition)
            {
                edition = new EventEdition
                {
                    EventId = ev.Id,
                    Date = firstDate,
                    Year = seasonYear,
                    Title = title,
                    RegistrationUrl = request.RegistrationUrl,
                    RegistrationStatus = RegistrationStatus.NotStarted,
                    Status = EditionStatus.Unconfirmed,
                    CreatedAt = DateTime.UtcNow,
                };
                _context.EventEditions.Add(edition);
                createdEditionIds.Add(edition.Id);
            }
            else
            {
                edition = existingEdition!;
            }

            // Create races for each date in the season
            var existingSortOrders = edition.Races.Select(r => r.SortOrder).DefaultIfEmpty(-1).Max();
            var sortOrder = existingSortOrders + 1;

            foreach (var date in seasonDates)
            {
                var isPast = date < today;
                var race = new Race
                {
                    EventEditionId = edition.Id,
                    TrailId = request.TrailId,
                    Name = $"Hlaup {sortOrder + 1}",
                    DateOfRace = date,
                    Status = isPast ? RaceStatus.Completed : RaceStatus.Active,
                    TicketStatus = isPast ? TicketStatus.Closed : TicketStatus.Available,
                    SortOrder = sortOrder,
                };
                _context.Races.Add(race);
                sortOrder++;
            }

            // A newly created season edition whose entire run has already elapsed (its last
            // race date is in the past) should read as Completed from creation, consistent with
            // the Completed status every one of its races just got above — CompleteWithRaces()
            // is a safe no-op over races that are already Completed, and closes registration too.
            if (isNewEdition && lastDate < today)
                edition.CompleteWithRaces();
        }

        var totalRacesCreated = newDates.Count;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(ev.Slug);

        return new GenerateEditionsResult(createdEditionIds, totalRacesCreated);
    }

    private static int GetSeasonYear(DateOnly date, int seasonStartMonth)
    {
        // If date's month >= season start month, it belongs to the season starting this year
        // Otherwise it belongs to the season that started the previous year
        return date.Month >= seasonStartMonth ? date.Year : date.Year - 1;
    }
}

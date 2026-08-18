using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetRaceDayEditions;

public record RaceDayRaceDto(
    Guid Id,
    string Name,
    string? NameEn,
    string? DistanceLabel,
    string? DistanceLabelEn,
    string Status,
    string TicketStatus,
    int SortOrder,
    string? ActivityType,
    int? CutoffMinutes,
    int? MaxParticipants,
    int? ItraPoints,
    string? CertifiedBy,
    decimal PrizeMoney,
    string? ChampionshipCategory,
    DateOnly? DateOfRace,
    TimeOnly? StartTime,
    Guid? TrailId,
    string? TrailName
);

public record RaceDayEditionDto(
    Guid Id,
    Guid EventId,
    string EventName,
    string EventSlug,
    string EventType,
    string EventStatus,
    string EditionStatus,
    DateOnly? Date,
    DateOnly? EndDate,
    string? Title,
    string? ResultsUrl,
    string? RegistrationUrl,
    string RegistrationStatus,
    List<RaceDayRaceDto> Races
);

public record GetRaceDayEditionsQuery(DateOnly Date) : IRequest<List<RaceDayEditionDto>>;

public class GetRaceDayEditionsQueryHandler : IRequestHandler<GetRaceDayEditionsQuery, List<RaceDayEditionDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetRaceDayEditionsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<RaceDayEditionDto>> Handle(GetRaceDayEditionsQuery request, CancellationToken cancellationToken)
    {
        var editions = await _context.EventEditions
            .AsNoTracking()
            .AsSplitQuery()
            .Include(ed => ed.Event)
            .Include(ed => ed.Races)
            .Where(ed =>
                ed.Date.HasValue &&
                ed.Date <= request.Date &&
                (ed.EndDate.HasValue ? ed.EndDate >= request.Date : ed.Date >= request.Date) &&
                ed.Event.Status != EventStatus.Hidden)
            .OrderBy(ed => ed.Event.Name)
            .ToListAsync(cancellationToken);

        var trailIds = editions
            .SelectMany(ed => ed.Races)
            .Where(r => r.TrailId.HasValue)
            .Select(r => r.TrailId!.Value)
            .Distinct().ToHashSet();

        var trailNames = trailIds.Count > 0
            ? await _context.Trails.AsNoTracking()
                .Where(t => trailIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Name })
                .ToDictionaryAsync(t => t.Id, t => t.Name, cancellationToken)
            : [];

        return editions.Select(ed => new RaceDayEditionDto(
            ed.Id,
            ed.EventId,
            ed.Event.Name,
            ed.Event.Slug,
            ed.Event.Type.ToString(),
            ed.Event.Status.ToString(),
            ed.Status.ToString(),
            ed.Date,
            ed.EndDate,
            ed.Title,
            ed.ResultsUrl,
            ed.RegistrationUrl,
            ed.RegistrationStatus.ToString(),
            ed.Races
                .OrderBy(r => r.SortOrder)
                .Select(r => new RaceDayRaceDto(
                    r.Id,
                    r.Name,
                    r.NameEn,
                    r.DistanceLabel,
                    r.DistanceLabelEn,
                    r.Status.ToString(),
                    r.TicketStatus.ToString(),
                    r.SortOrder,
                    r.ActivityType?.ToString(),
                    r.CutoffMinutes,
                    r.MaxParticipants,
                    r.ItraPoints,
                    r.CertifiedBy,
                    r.PrizeMoney,
                    r.ChampionshipCategory,
                    r.DateOfRace,
                    r.StartTime,
                    r.TrailId,
                    r.TrailId.HasValue && trailNames.TryGetValue(r.TrailId.Value, out var tn) ? tn : null
                ))
                .ToList()
        )).ToList();
    }
}

using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Events.Queries.GetEvent;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetAllEventDetails;

using Utanvega.Backend.Application.Events.Queries.GetEvents;

public record GetAllEventDetailsQuery : IRequest<List<EventDetailDto>>;

public class GetAllEventDetailsQueryHandler : IRequestHandler<GetAllEventDetailsQuery, List<EventDetailDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetAllEventDetailsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<EventDetailDto>> Handle(GetAllEventDetailsQuery request, CancellationToken cancellationToken)
    {
        var events = await _context.Events
            .AsNoTracking()
            .AsSplitQuery()
            .Include(e => e.Location)
            .Include(e => e.Organizer)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Trail)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
                    .ThenInclude(r => r.Trail)
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);

        static Dictionary<string, string>? DeserHashes(string? json) =>
            json == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(json);

        return events.Select(ev => new EventDetailDto(
            ev.Id,
            ev.Name,
            ev.Slug,
            ev.Description,
            ev.NameEn,
            ev.DescriptionEn,
            ev.Type.ToString(),
            ev.ActivityType.ToString(),
            ev.Status.ToString(),
            ev.Organizer?.Name ?? ev.OrganizerName,
            ev.OrganizerNameEn,
            ev.OrganizerWebsite ?? ev.Organizer?.Website,
            ev.OrganizerId,
            ev.AlertMessage,
            ev.AlertMessageEn,
            ev.AlertSeverity,
            ev.LocationId,
            ev.Location?.Name,
            ev.ScheduleRule,
            ev.SocialLinks,
            null,
            null,
            [],
            ev.Editions
                .OrderByDescending(ed => ed.Date ?? DateOnly.MinValue)
                .Select(ed => new EventEditionDto(
                    ed.Id,
                    ed.EventId,
                    ed.Year,
                    ed.Date,
                    ed.EndDate,
                    ed.Title,
                    ed.TitleEn,
                    ed.RegistrationUrl,
                    ed.ResultsUrl,
                    ed.Notes,
                    ed.NotesEn,
                    ed.RegistrationStatus.ToString(),
                    ed.TrailId,
                    ed.Trail?.Name,
                    ed.Trail?.Slug,
                    ed.Races
                        .OrderBy(r => r.SortOrder)
                        .Select(r => new RaceDto(
                            r.Id,
                            r.EventEditionId,
                            r.TrailId,
                            r.Trail?.Name,
                            r.Trail?.Slug,
                            r.Name,
                            r.NameEn,
                            r.DistanceLabel,
                            r.DistanceLabelEn,
                            r.CutoffMinutes,
                            r.Description,
                            r.DescriptionEn,
                            r.Status.ToString(),
                            r.SortOrder,
                            r.TicketStatus.ToString(),
                            r.MaxParticipants,
                            r.ItraPoints,
                            r.CertifiedBy,
                            r.CertifiedByEn,
                            r.PrizeMoney,
                            r.ChampionshipCategory,
                            r.ChampionshipCategoryEn,
                            r.DateOfRace,
                            r.StartTime,
                            r.Trail?.Length,
                            r.Trail?.ElevationGain,
                            r.Trail?.TerrainType?.ToString(),
                            r.Trail?.Difficulty.ToString(),
                            r.Trail?.ActivityTypeId.ToString(),
                            DeserHashes(r.TranslationHashes),
                            r.ActivityType?.ToString()
                        ))
                        .ToList(),
                    ed.CreatedAt,
                    ed.UpdatedAt,
                    DeserHashes(ed.TranslationHashes),
                    Status: ed.Status.ToString(),
                    EffectiveCancelled: EditionStatusHelpers.ComputeEffectiveCancelled(ed.Status, ed.Races.Select(r => r.Status).ToList())
                ))
                .ToList(),
            ev.CreatedAt,
            ev.UpdatedAt,
            TranslationHashes: DeserHashes(ev.TranslationHashes)
        )).ToList();
    }
}

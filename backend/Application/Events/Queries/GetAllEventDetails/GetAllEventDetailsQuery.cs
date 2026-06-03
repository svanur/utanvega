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
            .Include(e => e.Location)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Trail)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
                    .ThenInclude(r => r.Trail)
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);

        return events.Select(ev => new EventDetailDto(
            ev.Id,
            ev.Name,
            ev.Slug,
            ev.Description,
            ev.Type.ToString(),
            ev.ActivityType.ToString(),
            ev.Status.ToString(),
            ev.OrganizerName,
            ev.OrganizerWebsite,
            ev.AlertMessage,
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
                    ed.Title,
                    ed.RegistrationUrl,
                    ed.ResultsUrl,
                    ed.Notes,
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
                            r.DistanceLabel,
                            r.CutoffMinutes,
                            r.Description,
                            r.Status.ToString(),
                            r.SortOrder,
                            r.TicketStatus.ToString(),
                            r.MaxParticipants,
                            r.ItraPoints,
                            r.CertifiedBy,
                            r.PrizeMoney,
                            r.ChampionshipCategory,
                            r.DateOfRace,
                            r.StartTime,
                            r.Trail?.Length,
                            r.Trail?.ElevationGain
                        ))
                        .ToList(),
                    ed.CreatedAt,
                    ed.UpdatedAt
                ))
                .ToList(),
            ev.CreatedAt,
            ev.UpdatedAt
        )).ToList();
    }
}

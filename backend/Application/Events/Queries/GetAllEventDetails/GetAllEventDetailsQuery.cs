using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Events.Queries.GetEvent;
using Utanvega.Backend.Application.PhotoGalleries;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetAllEventDetails;

using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Application.Events.Queries.GetEvents;

public record GetAllEventDetailsQuery : IRequest<List<EventDetailDto>>;

public class GetAllEventDetailsQueryHandler : IRequestHandler<GetAllEventDetailsQuery, List<EventDetailDto>>
{
    private readonly UtanvegaDbContext _context;

    private record TrailDetail(string? Name, string? Slug, double Length, double ElevationGain, Core.Entities.TerrainType? TerrainType, Core.Entities.Difficulty Difficulty, Core.Entities.ActivityType ActivityTypeId, string? YoutubeUrl);

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
                .ThenInclude(ed => ed.Races)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.PhotoGalleries)
                    .ThenInclude(g => g.Photographer)
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);

        var trailIds = events
            .SelectMany(e => e.Editions)
            .SelectMany(ed => ed.Races.Select(r => r.TrailId).Append(ed.TrailId))
            .Where(id => id.HasValue).Select(id => id!.Value)
            .Distinct().ToHashSet();

        var trailDetails = trailIds.Count > 0
            ? (await _context.Trails.AsNoTracking()
                .Where(t => trailIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Name, t.Slug, t.Length, t.ElevationGain, t.TerrainType, t.Difficulty, t.ActivityTypeId, t.YoutubeUrl })
                .ToListAsync(cancellationToken))
                .ToDictionary(t => t.Id, t => new TrailDetail(t.Name, t.Slug, t.Length, t.ElevationGain, t.TerrainType, t.Difficulty, t.ActivityTypeId, t.YoutubeUrl))
            : new Dictionary<Guid, TrailDetail>();

        TrailDetail? GetTrail(Guid? id) => id.HasValue && trailDetails.TryGetValue(id.Value, out var td) ? td : null;

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
                    ed.PhotoGalleryUrl,
                    ed.Notes,
                    ed.NotesEn,
                    ed.RegistrationStatus.ToString(),
                    ed.TrailId,
                    GetTrail(ed.TrailId)?.Name,
                    GetTrail(ed.TrailId)?.Slug,
                    ed.Races
                        .OrderBy(r => r.SortOrder)
                        .Select(r => new RaceDto(
                            r.Id,
                            r.EventEditionId,
                            r.TrailId,
                            GetTrail(r.TrailId)?.Name,
                            GetTrail(r.TrailId)?.Slug,
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
                            GetTrail(r.TrailId)?.Length,
                            GetTrail(r.TrailId)?.ElevationGain,
                            GetTrail(r.TrailId)?.TerrainType?.ToString(),
                            GetTrail(r.TrailId)?.Difficulty.ToString(),
                            GetTrail(r.TrailId)?.ActivityTypeId.ToString(),
                            DeserHashes(r.TranslationHashes),
                            r.ActivityType?.ToString(),
                            r.ResultType.ToString()
                        ))
                        .ToList(),
                    ed.PhotoGalleries.ToPublicDtos(),
                    ed.CreatedAt,
                    ed.UpdatedAt,
                    DeserHashes(ed.TranslationHashes),
                    Status: ed.Status.ToString(),
                    EffectiveCancelled: EditionStatusHelpers.ComputeEffectiveCancelled(ed.Status, ed.Races.Select(r => r.Status).ToList())
                ))
                .ToList(),
            ev.CreatedAt,
            ev.UpdatedAt,
            TranslationHashes: DeserHashes(ev.TranslationHashes),
            OrganizerSlug: ev.Organizer != null ? ev.Organizer.Slug : null
        )).ToList();
    }
}

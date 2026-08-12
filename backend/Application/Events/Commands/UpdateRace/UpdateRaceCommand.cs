using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.UpdateRace;

public record UpdateRaceCommand(
    Guid Id,
    Guid? TrailId,
    string Name,
    string? DistanceLabel,
    int? CutoffMinutes,
    string? Description,
    string Status,
    int SortOrder,
    string TicketStatus,
    string ResultType,
    int? MaxParticipants,
    int? ItraPoints,
    string? CertifiedBy,
    decimal PrizeMoney,
    string? ChampionshipCategory,
    DateOnly? DateOfRace,
    TimeOnly? StartTime,
    string? NameEn = null,
    string? DescriptionEn = null,
    string? CertifiedByEn = null,
    string? ChampionshipCategoryEn = null,
    Dictionary<string, string>? TranslationHashes = null,
    string? ActivityType = null,
    string? DistanceLabelEn = null
) : IRequest<bool>;

public class UpdateRaceCommandHandler : IRequestHandler<UpdateRaceCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateRaceCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(UpdateRaceCommand request, CancellationToken cancellationToken)
    {
        var race = await _context.Races
            .Include(r => r.EventEdition)
                .ThenInclude(ed => ed.Event)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (race == null) return false;

        Enum.TryParse<RaceStatus>(request.Status, ignoreCase: true, out var status);
        Enum.TryParse<TicketStatus>(request.TicketStatus, ignoreCase: true, out var ticketStatus);
        Enum.TryParse<ResultType>(request.ResultType, ignoreCase: true, out var resultType);
        if (status == RaceStatus.Cancelled)
            // A cancelled race always reads as ticket-closed, regardless of what was submitted —
            // mirrors how a cancelled edition always closes its own RegistrationStatus.
            ticketStatus = TicketStatus.Closed;
        race.ActivityType = Enum.TryParse<ActivityType>(request.ActivityType, ignoreCase: true, out var at) ? at : (ActivityType?)null;

        race.TrailId = request.TrailId;
        race.Name = request.Name;
        race.NameEn = request.NameEn;
        race.DistanceLabel = request.DistanceLabel;
        race.DistanceLabelEn = request.DistanceLabelEn;
        race.CutoffMinutes = request.CutoffMinutes;
        race.Description = request.Description;
        race.DescriptionEn = request.DescriptionEn;
        race.Status = status;
        race.SortOrder = request.SortOrder;
        race.TicketStatus = ticketStatus;
        race.ResultType = resultType;
        race.MaxParticipants = request.MaxParticipants;
        race.ItraPoints = request.ItraPoints;
        race.CertifiedBy = request.CertifiedBy;
        race.CertifiedByEn = request.CertifiedByEn;
        race.PrizeMoney = request.PrizeMoney;
        race.ChampionshipCategory = request.ChampionshipCategory;
        race.ChampionshipCategoryEn = request.ChampionshipCategoryEn;
        race.DateOfRace = request.DateOfRace;
        race.StartTime = request.StartTime;
        if (request.TranslationHashes != null)
            race.TranslationHashes = JsonSerializer.Serialize(request.TranslationHashes);

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(race.EventEdition.Event.Slug);
        return true;
    }
}

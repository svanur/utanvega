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
    int? MaxParticipants,
    int? ItraPoints,
    string? CertifiedBy,
    decimal PrizeMoney,
    string? ChampionshipCategory,
    DateOnly? DateOfRace,
    TimeOnly? StartTime
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

        race.TrailId = request.TrailId;
        race.Name = request.Name;
        race.DistanceLabel = request.DistanceLabel;
        race.CutoffMinutes = request.CutoffMinutes;
        race.Description = request.Description;
        race.Status = status;
        race.SortOrder = request.SortOrder;
        race.TicketStatus = ticketStatus;
        race.MaxParticipants = request.MaxParticipants;
        race.ItraPoints = request.ItraPoints;
        race.CertifiedBy = request.CertifiedBy;
        race.PrizeMoney = request.PrizeMoney;
        race.ChampionshipCategory = request.ChampionshipCategory;
        race.DateOfRace = request.DateOfRace;
        race.StartTime = request.StartTime;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(race.EventEdition.Event.Slug);
        return true;
    }
}

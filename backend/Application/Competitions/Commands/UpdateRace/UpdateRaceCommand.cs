using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Commands.UpdateRace;

public record UpdateRaceCommand(
    Guid Id,
    Guid? TrailId,
    string Name,
    string? DistanceLabel,
    int? CutoffMinutes,
    string? Description,
    string Status,
    int SortOrder
) : IRequest<bool>;

public class UpdateRaceCommandHandler : IRequestHandler<UpdateRaceCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public UpdateRaceCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateRaceCommand request, CancellationToken cancellationToken)
    {
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (race == null) return false;

        Enum.TryParse<RaceStatus>(request.Status, true, out var status);

        race.TrailId = request.TrailId;
        race.Name = request.Name;
        race.DistanceLabel = request.DistanceLabel;
        race.CutoffMinutes = request.CutoffMinutes;
        race.Description = request.Description;
        race.Status = status;
        race.SortOrder = request.SortOrder;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

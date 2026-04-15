using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Commands.CreateRace;

public record CreateRaceCommand(
    Guid CompetitionId,
    Guid? TrailId,
    string Name,
    string? DistanceLabel,
    int? CutoffMinutes,
    string? Description,
    string Status,
    int SortOrder
) : IRequest<Guid>;

public class CreateRaceCommandHandler : IRequestHandler<CreateRaceCommand, Guid>
{
    private readonly UtanvegaDbContext _context;

    public CreateRaceCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<Guid> Handle(CreateRaceCommand request, CancellationToken cancellationToken)
    {
        Enum.TryParse<RaceStatus>(request.Status, true, out var status);

        var race = new Race
        {
            CompetitionId = request.CompetitionId,
            TrailId = request.TrailId,
            Name = request.Name,
            DistanceLabel = request.DistanceLabel,
            CutoffMinutes = request.CutoffMinutes,
            Description = request.Description,
            Status = status,
            SortOrder = request.SortOrder,
        };

        _context.Races.Add(race);
        await _context.SaveChangesAsync(cancellationToken);

        return race.Id;
    }
}

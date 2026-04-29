using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
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
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreateRaceCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
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

        var slug = await _context.Competitions
            .AsNoTracking()
            .Where(c => c.Id == request.CompetitionId)
            .Select(c => c.Slug)
            .FirstOrDefaultAsync(cancellationToken);

        _cacheInvalidator.InvalidateCompetition(slug);

        return race.Id;
    }
}

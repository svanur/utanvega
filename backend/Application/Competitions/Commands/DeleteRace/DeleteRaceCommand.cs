using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Commands.DeleteRace;

public record DeleteRaceCommand(Guid Id) : IRequest<bool>;

public class DeleteRaceCommandHandler : IRequestHandler<DeleteRaceCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public DeleteRaceCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteRaceCommand request, CancellationToken cancellationToken)
    {
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (race == null) return false;

        _context.Races.Remove(race);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

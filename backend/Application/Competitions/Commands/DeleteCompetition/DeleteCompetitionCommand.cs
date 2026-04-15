using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Commands.DeleteCompetition;

public record DeleteCompetitionCommand(Guid Id) : IRequest<bool>;

public class DeleteCompetitionCommandHandler : IRequestHandler<DeleteCompetitionCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public DeleteCompetitionCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteCompetitionCommand request, CancellationToken cancellationToken)
    {
        var competition = await _context.Competitions
            .Include(c => c.Races)
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (competition == null) return false;

        _context.Competitions.Remove(competition); // Cascade deletes races
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

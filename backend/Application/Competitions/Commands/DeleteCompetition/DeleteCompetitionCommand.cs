using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Commands.DeleteCompetition;

public record DeleteCompetitionCommand(Guid Id) : IRequest<bool>;

public class DeleteCompetitionCommandHandler : IRequestHandler<DeleteCompetitionCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeleteCompetitionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(DeleteCompetitionCommand request, CancellationToken cancellationToken)
    {
        var competition = await _context.Competitions
            .Include(c => c.Races)
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (competition == null) return false;

        var slug = competition.Slug;
        _context.Competitions.Remove(competition);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateCompetition(slug);
        return true;
    }
}

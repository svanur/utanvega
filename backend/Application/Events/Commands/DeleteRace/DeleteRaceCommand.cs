using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.DeleteRace;

public record DeleteRaceCommand(Guid Id) : IRequest<bool>;

public class DeleteRaceCommandHandler : IRequestHandler<DeleteRaceCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeleteRaceCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(DeleteRaceCommand request, CancellationToken cancellationToken)
    {
        var race = await _context.Races
            .Include(r => r.EventEdition)
                .ThenInclude(ed => ed.Event)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (race == null) return false;

        var slug = race.EventEdition.Event.Slug;
        _context.Races.Remove(race);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(slug);
        return true;
    }
}

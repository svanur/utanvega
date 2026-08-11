using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.CancelEdition;

public record CancelEditionCommand(Guid Id) : IRequest<bool>;

public class CancelEditionCommandHandler : IRequestHandler<CancelEditionCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CancelEditionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    // Dedicated, one-way cascading action: cancels the edition and every one of its races in a
    // single operation. This is intentionally separate from UpdateEditionCommand (which never
    // touches Race rows) so the cascade only ever happens through this explicit path.
    public async Task<bool> Handle(CancelEditionCommand request, CancellationToken cancellationToken)
    {
        var edition = await _context.EventEditions
            .Include(ed => ed.Event)
            .Include(ed => ed.Races)
            .FirstOrDefaultAsync(ed => ed.Id == request.Id, cancellationToken);

        if (edition == null) return false;

        edition.Status = EditionStatus.Cancelled;
        edition.UpdatedAt = DateTime.UtcNow;

        foreach (var race in edition.Races.Where(r => r.Status != RaceStatus.Cancelled))
            race.Status = RaceStatus.Cancelled;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(edition.Event.Slug);
        return true;
    }
}

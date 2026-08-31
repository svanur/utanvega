using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.CancelEvent;

public record CancelEventCommand(Guid Id) : IRequest<bool>;

public class CancelEventCommandHandler : IRequestHandler<CancelEventCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CancelEventCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    // One-click shortcut for the same cascade PatchEventStatusCommand/UpdateEventCommand apply when
    // Status transitions to Cancelled — this just doesn't require opening the edit dialog first.
    public async Task<bool> Handle(CancelEventCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .Include(e => e.Editions)
            .ThenInclude(ed => ed.Races)
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev == null) return false;

        ev.CancelWithEditions(DateOnly.FromDateTime(DateTime.UtcNow));
        ev.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(ev.Slug);
        return true;
    }
}

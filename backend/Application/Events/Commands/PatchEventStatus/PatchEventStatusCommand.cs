using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.PatchEventStatus;

public record PatchEventStatusCommand(Guid Id, string Status, string? ActorUserId = null) : IRequest<bool>;

public class PatchEventStatusCommandHandler : IRequestHandler<PatchEventStatusCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public PatchEventStatusCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(PatchEventStatusCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .Include(e => e.Editions)
            .ThenInclude(ed => ed.Races)
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev is null) return false;

        if (!Enum.TryParse<EventStatus>(request.Status, ignoreCase: true, out var status)) return false;

        var cascading = status == EventStatus.Cancelled && ev.Status != EventStatus.Cancelled;
        if (cascading)
            // Transitioning into Cancelled always cascades to qualifying editions (and their races)
            // regardless of which path (this generic patch, the full edit form, or the dedicated
            // Cancel action) triggered it.
            ev.CancelWithEditions(DateOnly.FromDateTime(DateTime.UtcNow));
        else
            ev.Status = status;

        await _context.SaveChangesWithAuditAsync(request.ActorUserId);

        if (cascading)
            // Matches CancelEventCommand/CancelEditionCommand's pattern — the public site must not
            // keep serving a stale "active" page for an event this endpoint just cascade-cancelled.
            _cacheInvalidator.InvalidateEvent(ev.Slug);

        return true;
    }
}

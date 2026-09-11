using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.CompleteEdition;

public record CompleteEditionCommand(Guid Id) : IRequest<bool>;

public class CompleteEditionCommandHandler : IRequestHandler<CompleteEditionCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CompleteEditionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    // One-click shortcut for the same cascade UpdateEditionCommand applies when its Status field
    // transitions to Completed — mirrors CancelEditionCommand's shape so this doesn't require
    // opening the edit dialog (and resending every field) first. See issue #741: the generic
    // UpdateEditionCommand PUT is a full-resend contract, and callers that only want to flip
    // Status were silently wiping Year/Title/Notes/Trail by sending nulls for everything else.
    public async Task<bool> Handle(CompleteEditionCommand request, CancellationToken cancellationToken)
    {
        var edition = await _context.EventEditions
            .Include(ed => ed.Event)
            .Include(ed => ed.Races)
            .FirstOrDefaultAsync(ed => ed.Id == request.Id, cancellationToken);

        if (edition == null) return false;

        edition.CompleteWithRaces();
        edition.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(edition.Event.Slug);
        return true;
    }
}

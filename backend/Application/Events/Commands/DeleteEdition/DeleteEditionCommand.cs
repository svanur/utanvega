using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.DeleteEdition;

public record DeleteEditionCommand(Guid Id) : IRequest<bool>;

public class DeleteEditionCommandHandler : IRequestHandler<DeleteEditionCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeleteEditionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(DeleteEditionCommand request, CancellationToken cancellationToken)
    {
        var edition = await _context.EventEditions
            .Include(ed => ed.Event)
            .FirstOrDefaultAsync(ed => ed.Id == request.Id, cancellationToken);

        if (edition == null) return false;

        var slug = edition.Event.Slug;
        _context.EventEditions.Remove(edition);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(slug);
        return true;
    }
}

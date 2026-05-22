using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.DeleteEvent;

public record DeleteEventCommand(Guid Id) : IRequest<bool>;

public class DeleteEventCommandHandler : IRequestHandler<DeleteEventCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeleteEventCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(DeleteEventCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev == null) return false;

        var slug = ev.Slug;
        _context.Events.Remove(ev);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(slug);
        return true;
    }
}

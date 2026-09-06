using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.PhotoGalleries;

public record DeletePhotoGalleryCommand(Guid Id) : IRequest<bool>;

public class DeletePhotoGalleryCommandHandler : IRequestHandler<DeletePhotoGalleryCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeletePhotoGalleryCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(DeletePhotoGalleryCommand request, CancellationToken cancellationToken)
    {
        var gallery = await _context.PhotoGalleries
            .Include(g => g.EventEdition)
            .ThenInclude(ed => ed.Event)
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);
        if (gallery is null) return false;

        // Capture the slug before the row is removed — after Remove/SaveChanges the navigation
        // is still in memory, but resolving it up front keeps the intent explicit.
        var eventSlug = gallery.EventEdition.Event.Slug;

        _context.PhotoGalleries.Remove(gallery);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(eventSlug);
        return true;
    }
}

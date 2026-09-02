using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.PhotoGalleries;

public record CreatePhotoGalleryCommand(
    Guid EventEditionId,
    string Url,
    Guid? PhotographerId,
    string? Title,
    string? TitleEn = null,
    int SortOrder = 0,
    string? CreatedBy = null
) : IRequest<Guid>;

public class CreatePhotoGalleryCommandHandler : IRequestHandler<CreatePhotoGalleryCommand, Guid>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreatePhotoGalleryCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<Guid> Handle(CreatePhotoGalleryCommand request, CancellationToken cancellationToken)
    {
        // Resolve the event slug up front so a stale FK can't sneak an entity into the table
        // without us knowing which public page to invalidate.
        var edition = await _context.EventEditions
            .Include(ed => ed.Event)
            .FirstOrDefaultAsync(ed => ed.Id == request.EventEditionId, cancellationToken);

        var gallery = new PhotoGallery
        {
            EventEditionId = request.EventEditionId,
            Url = request.Url,
            PhotographerId = request.PhotographerId,
            Title = request.Title,
            TitleEn = request.TitleEn,
            SortOrder = request.SortOrder,
            CreatedBy = request.CreatedBy,
        };

        _context.PhotoGalleries.Add(gallery);
        await _context.SaveChangesAsync(cancellationToken);

        if (edition is not null)
            _cacheInvalidator.InvalidateEvent(edition.Event.Slug);

        return gallery.Id;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.PhotoGalleries;

// One gallery, with just enough of its event/edition to link and display it in the admin
// photographer detail page's gallery list — mirrors GetPhotoGalleriesByEditionQuery's shape but
// keyed by photographer instead of edition, and (being admin-only) doesn't filter out
// hidden/unlisted events the way GetPhotographerPublicBySlugQuery does.
public record PhotoGalleryByPhotographerDto(
    Guid Id,
    Guid EventEditionId,
    string Url,
    string? Title,
    string? TitleEn,
    Guid EventId,
    string EventName,
    string? EventNameEn,
    string EventSlug,
    int? EditionYear,
    DateOnly? EditionDate
);

public record GetPhotoGalleriesByPhotographerQuery(Guid PhotographerId) : IRequest<List<PhotoGalleryByPhotographerDto>>;

public class GetPhotoGalleriesByPhotographerQueryHandler : IRequestHandler<GetPhotoGalleriesByPhotographerQuery, List<PhotoGalleryByPhotographerDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetPhotoGalleriesByPhotographerQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<PhotoGalleryByPhotographerDto>> Handle(GetPhotoGalleriesByPhotographerQuery request, CancellationToken cancellationToken)
    {
        return await _context.PhotoGalleries
            .AsNoTracking()
            .Where(g => g.PhotographerId == request.PhotographerId)
            .OrderByDescending(g => g.EventEdition.Year)
            .ThenByDescending(g => g.EventEdition.Date)
            .Select(g => new PhotoGalleryByPhotographerDto(
                g.Id,
                g.EventEditionId,
                g.Url,
                g.Title,
                g.TitleEn,
                g.EventEdition.Event.Id,
                g.EventEdition.Event.Name,
                g.EventEdition.Event.NameEn,
                g.EventEdition.Event.Slug,
                g.EventEdition.Year,
                g.EventEdition.Date
            ))
            .ToListAsync(cancellationToken);
    }
}

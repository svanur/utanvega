using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.PhotoGalleries;

public record GetPhotoGalleriesByEditionQuery(Guid EventEditionId) : IRequest<List<PhotoGalleryDto>>;

public class GetPhotoGalleriesByEditionQueryHandler : IRequestHandler<GetPhotoGalleriesByEditionQuery, List<PhotoGalleryDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetPhotoGalleriesByEditionQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<PhotoGalleryDto>> Handle(GetPhotoGalleriesByEditionQuery request, CancellationToken cancellationToken)
    {
        return await _context.PhotoGalleries
            .AsNoTracking()
            .Where(g => g.EventEditionId == request.EventEditionId)
            .OrderBy(g => g.SortOrder)
            .Select(g => new PhotoGalleryDto(
                g.Id,
                g.EventEditionId,
                g.Url,
                g.PhotographerId,
                g.Photographer == null ? null : g.Photographer.Name,
                g.Title,
                g.TitleEn,
                g.SortOrder,
                g.CreatedAt,
                g.CreatedBy
            ))
            .ToListAsync(cancellationToken);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Photographers;

// Deliberately not ICacheable — PhotoGallery writes don't yet invalidate related caches (#559),
// so a cached read path here would create the same staleness class the organizer page already has.
public record GetPhotographerPublicBySlugQuery(string Slug) : IRequest<PhotographerPublicDto?>;

public class GetPhotographerPublicBySlugQueryHandler : IRequestHandler<GetPhotographerPublicBySlugQuery, PhotographerPublicDto?>
{
    private readonly UtanvegaDbContext _context;

    public GetPhotographerPublicBySlugQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<PhotographerPublicDto?> Handle(GetPhotographerPublicBySlugQuery request, CancellationToken cancellationToken)
    {
        var photographer = await _context.Photographers
            .AsNoTracking()
            .Where(p => p.Slug == request.Slug)
            .Select(p => new { p.Id, p.Name, p.Slug, p.Website, p.Description, p.DescriptionEn, p.SocialLinks })
            .FirstOrDefaultAsync(cancellationToken);

        if (photographer is null) return null;

        var galleries = await _context.PhotoGalleries
            .AsNoTracking()
            .Where(g => g.PhotographerId == photographer.Id
                && g.EventEdition.Event.Status != EventStatus.Hidden
                && g.EventEdition.Event.Status != EventStatus.Unlisted)
            .Select(g => new PhotographerGalleryEntryDto(
                g.EventEdition.Event.Id,
                g.EventEdition.Event.Name,
                g.EventEdition.Event.NameEn,
                g.EventEdition.Event.Slug,
                g.EventEdition.Id,
                g.EventEdition.Year,
                g.EventEdition.Date,
                g.Url,
                g.Title,
                g.TitleEn
            ))
            .ToListAsync(cancellationToken);

        // Newest edition first. Undated editions sort by Year (placed at year-end); an edition
        // with neither Date nor Year sinks to the bottom rather than being dropped.
        var sortedGalleries = galleries
            .OrderByDescending(g => g.EditionDate ?? (g.EditionYear.HasValue ? new DateOnly(g.EditionYear.Value, 12, 31) : DateOnly.MinValue))
            .ToList();

        return new PhotographerPublicDto(
            photographer.Name, photographer.Slug, photographer.Website,
            photographer.Description, photographer.DescriptionEn,
            sortedGalleries, photographer.SocialLinks
        );
    }
}

using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Photographers;

public record GetPhotographerBySlugQuery(string Slug) : IRequest<PhotographerDto?>;

public class GetPhotographerBySlugQueryHandler : IRequestHandler<GetPhotographerBySlugQuery, PhotographerDto?>
{
    private readonly UtanvegaDbContext _context;

    public GetPhotographerBySlugQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<PhotographerDto?> Handle(GetPhotographerBySlugQuery request, CancellationToken cancellationToken)
    {
        var raw = await _context.Photographers
            .AsNoTracking()
            .Where(p => p.Slug == request.Slug)
            .Select(p => new { p.Id, p.Name, p.Slug, p.Website, p.Email, p.Description, p.DescriptionEn, GalleryCount = p.PhotoGalleries.Count, p.CreatedAt, p.UpdatedAt, p.TranslationHashes, p.SocialLinks })
            .FirstOrDefaultAsync(cancellationToken);

        if (raw is null) return null;

        return new PhotographerDto(
            raw.Id, raw.Name, raw.Slug, raw.Website, raw.Email,
            raw.Description, raw.DescriptionEn, raw.GalleryCount, raw.CreatedAt, raw.UpdatedAt,
            raw.TranslationHashes == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(raw.TranslationHashes),
            raw.SocialLinks
        );
    }
}

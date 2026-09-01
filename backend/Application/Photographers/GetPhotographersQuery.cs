using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Photographers;

public record GetPhotographersQuery : IRequest<List<PhotographerDto>>;

public class GetPhotographersQueryHandler : IRequestHandler<GetPhotographersQuery, List<PhotographerDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetPhotographersQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<PhotographerDto>> Handle(GetPhotographersQuery request, CancellationToken cancellationToken)
    {
        var raw = await _context.Photographers
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new { p.Id, p.Name, p.Slug, p.Website, p.Email, p.Description, p.DescriptionEn, p.CreatedAt, p.UpdatedAt, p.TranslationHashes, p.SocialLinks })
            .ToListAsync(cancellationToken);

        return raw.Select(p => new PhotographerDto(
            p.Id, p.Name, p.Slug, p.Website, p.Email,
            p.Description, p.DescriptionEn, p.CreatedAt, p.UpdatedAt,
            p.TranslationHashes == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(p.TranslationHashes),
            p.SocialLinks
        )).ToList();
    }
}

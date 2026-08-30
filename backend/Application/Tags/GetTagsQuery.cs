using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Tags;

public record GetTagsQuery : IRequest<List<TagDto>>;

public class GetTagsQueryHandler : IRequestHandler<GetTagsQuery, List<TagDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetTagsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<TagDto>> Handle(GetTagsQuery request, CancellationToken cancellationToken)
    {
        return await _context.Tags
            .AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new TagDto(t.Id, t.Name, t.NameEn, t.Slug, t.Color, t.TrailTags.Count, t.TranslationHashes))
            .ToListAsync(cancellationToken);
    }
}

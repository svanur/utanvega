using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Organizers;

public record GetOrganizersQuery : IRequest<List<OrganizerDto>>;

public class GetOrganizersQueryHandler : IRequestHandler<GetOrganizersQuery, List<OrganizerDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetOrganizersQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<OrganizerDto>> Handle(GetOrganizersQuery request, CancellationToken cancellationToken)
    {
        var raw = await _context.Organizers
            .AsNoTracking()
            .OrderBy(o => o.Name)
            .Select(o => new { o.Id, o.Name, o.Slug, o.Kennitala, o.Phone, o.Email, o.Website, o.Description, o.DescriptionEn, o.ContactName, EventCount = o.Events.Count, o.CreatedAt, o.UpdatedAt, o.TranslationHashes })
            .ToListAsync(cancellationToken);

        return raw.Select(o => new OrganizerDto(
            o.Id, o.Name, o.Slug, o.Kennitala, o.Phone, o.Email, o.Website,
            o.Description, o.DescriptionEn, o.ContactName, o.EventCount, o.CreatedAt, o.UpdatedAt,
            o.TranslationHashes == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(o.TranslationHashes)
        )).ToList();
    }
}

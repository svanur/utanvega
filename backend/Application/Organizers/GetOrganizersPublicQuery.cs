using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Organizers;

public record GetOrganizersPublicQuery : IRequest<List<OrganizerPublicDto>>;

public class GetOrganizersPublicQueryHandler : IRequestHandler<GetOrganizersPublicQuery, List<OrganizerPublicDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetOrganizersPublicQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<OrganizerPublicDto>> Handle(GetOrganizersPublicQuery request, CancellationToken cancellationToken)
    {
        return await _context.Organizers
            .AsNoTracking()
            .OrderBy(o => o.Name)
            .Select(o => new OrganizerPublicDto(o.Id, o.Name, o.Slug, o.Website, o.Description, o.DescriptionEn, o.ContactName, new List<OrganizerEventSummaryDto>(), o.SocialLinks))
            .ToListAsync(cancellationToken);
    }
}

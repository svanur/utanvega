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
        return await _context.Organizers
            .AsNoTracking()
            .OrderBy(o => o.Name)
            .Select(o => new OrganizerDto(o.Id, o.Name, o.Kennitala, o.Phone, o.Email, o.Website, o.Description, o.ContactName, o.CreatedAt, o.UpdatedAt))
            .ToListAsync(cancellationToken);
    }
}

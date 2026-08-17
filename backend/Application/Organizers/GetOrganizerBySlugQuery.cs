using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Organizers;

public record GetOrganizerBySlugQuery(string Slug) : IRequest<OrganizerPublicDto?>, ICacheable
{
    public string CacheKey => CacheKeys.Organizer(Slug);
    public TimeSpan CacheDuration => TimeSpan.FromMinutes(60);
}

public class GetOrganizerBySlugQueryHandler : IRequestHandler<GetOrganizerBySlugQuery, OrganizerPublicDto?>
{
    private readonly UtanvegaDbContext _context;

    public GetOrganizerBySlugQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<OrganizerPublicDto?> Handle(GetOrganizerBySlugQuery request, CancellationToken cancellationToken)
    {
        return await _context.Organizers
            .AsNoTracking()
            .Where(o => o.Slug == request.Slug)
            .Select(o => new OrganizerPublicDto(o.Id, o.Name, o.Slug, o.Website, o.Description, o.DescriptionEn, o.ContactName))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

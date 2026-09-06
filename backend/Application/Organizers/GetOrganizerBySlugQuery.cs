using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
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
        var organizer = await _context.Organizers
            .AsNoTracking()
            .Where(o => o.Slug == request.Slug)
            .Select(o => new { o.Id, o.Name, o.Slug, o.Website, o.Description, o.DescriptionEn, o.ContactName, o.SocialLinks })
            .FirstOrDefaultAsync(cancellationToken);

        if (organizer is null) return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var events = await _context.Events
            .AsNoTracking()
            .Where(e => e.OrganizerId == organizer.Id
                && e.Status != EventStatus.Hidden
                && e.Status != EventStatus.Unlisted)
            .OrderBy(e => e.Name)
            .Select(e => new OrganizerEventSummaryDto(
                e.Id,
                e.Name,
                e.NameEn,
                e.Slug,
                e.Description,
                e.DescriptionEn,
                e.ActivityType.ToString(),
                e.Editions
                    .Where(ed => ed.Date >= today)
                    .OrderBy(ed => ed.Date)
                    .Select(ed => (DateOnly?)ed.Date)
                    .FirstOrDefault(),
                e.Editions
                    .Where(ed => ed.Date >= today)
                    .OrderBy(ed => ed.Date)
                    .Select(ed => ed.EndDate)
                    .FirstOrDefault()
            ))
            .ToListAsync(cancellationToken);

        return new OrganizerPublicDto(
            organizer.Name, organizer.Slug, organizer.Website,
            organizer.Description, organizer.DescriptionEn, organizer.ContactName,
            events, organizer.SocialLinks
        );
    }
}

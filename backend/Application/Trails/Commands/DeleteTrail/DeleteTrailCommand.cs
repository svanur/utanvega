using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.DeleteTrail;

public record DeleteTrailCommand(Guid Id) : IRequest<bool>;

public class DeleteTrailCommandHandler : IRequestHandler<DeleteTrailCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeleteTrailCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(DeleteTrailCommand request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);
        if (trail == null) return false;

        var slug = trail.Slug;

        // Soft delete: Change status and free the slug for reuse
        trail.Status = TrailStatus.Deleted;
        trail.Slug = $"{trail.Slug}-deleted-{Guid.NewGuid().ToString()[..8]}";
        trail.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesWithAuditAsync("system");
        _cacheInvalidator.InvalidateTrail(slug);
        return true;
    }
}

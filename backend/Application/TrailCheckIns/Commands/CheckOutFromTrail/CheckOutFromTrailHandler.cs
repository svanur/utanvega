namespace Utanvega.Backend.Application.TrailCheckIns.Commands.CheckOutFromTrail;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

public class CheckOutFromTrailHandler : IRequestHandler<CheckOutFromTrailCommand, bool>
{
    private readonly UtanvegaDbContext _dbContext;

    public CheckOutFromTrailHandler(UtanvegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(CheckOutFromTrailCommand request, CancellationToken cancellationToken)
    {
        var normalizedSlug = request.TrailSlug.Trim().ToLowerInvariant();
        var trail = await _dbContext.Trails
            .AsNoTracking()
            .Where(t => t.Slug == normalizedSlug && t.Status != TrailStatus.Archived)
            .Select(t => new { t.Id })
            .FirstOrDefaultAsync(cancellationToken);

        if (trail is null)
        {
            throw new InvalidOperationException("Trail not found");
        }

        var checkIn = await _dbContext.TrailCheckIns
            .FirstOrDefaultAsync(
                c => c.TrailId == trail.Id && c.UserId == request.UserId,
                cancellationToken
            );
        if (checkIn is null)
        {
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        checkIn.UpdatedAt = now;
        checkIn.ExpiresAt = now;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}

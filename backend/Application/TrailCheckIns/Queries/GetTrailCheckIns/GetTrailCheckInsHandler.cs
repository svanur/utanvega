namespace Utanvega.Backend.Application.TrailCheckIns.Queries.GetTrailCheckIns;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.TrailCheckIns.Commands.CheckInToTrail;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

public class GetTrailCheckInsHandler : IRequestHandler<GetTrailCheckInsQuery, GetTrailCheckInsResponse>
{
    private readonly UtanvegaDbContext _dbContext;

    public GetTrailCheckInsHandler(UtanvegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<GetTrailCheckInsResponse> Handle(GetTrailCheckInsQuery request, CancellationToken cancellationToken)
    {
        var normalizedSlug = request.TrailSlug.Trim().ToLowerInvariant();
        var trail = await _dbContext.Trails
            .AsNoTracking()
            .Where(t => t.Slug == normalizedSlug && t.Status != TrailStatus.Deleted)
            .Select(t => new { t.Id })
            .FirstOrDefaultAsync(cancellationToken);

        if (trail is null)
        {
            throw new InvalidOperationException("Trail not found");
        }

        var now = DateTimeOffset.UtcNow;
        var activeCheckIns = await _dbContext.TrailCheckIns
            .AsNoTracking()
            .Where(c => c.TrailId == trail.Id && c.ExpiresAt > now)
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync(cancellationToken);

        var userIds = activeCheckIns.Select(c => c.UserId).ToList();
        var profiles = await _dbContext.Profiles
            .AsNoTracking()
            .Where(p => userIds.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, cancellationToken);

        var entries = activeCheckIns
            .Select(c =>
            {
                var hasProfile = profiles.TryGetValue(c.UserId, out var profile);
                var displayName = hasProfile && !string.IsNullOrWhiteSpace(profile!.DisplayName)
                    ? profile.DisplayName
                    : $"Runner-{c.UserId.ToString("N")[..6]}";
                return new TrailCheckInDto(
                    c.Id,
                    c.TrailId,
                    c.UserId,
                    displayName,
                    profile?.AvatarUrl,
                    c.UpdatedAt,
                    c.ExpiresAt
                );
            })
            .ToList();

        return new GetTrailCheckInsResponse(trail.Id, entries, entries.Count);
    }
}

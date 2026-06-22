namespace Utanvega.Backend.Application.TrailCheckIns.Commands.CheckInToTrail;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

public class CheckInToTrailHandler : IRequestHandler<CheckInToTrailCommand, TrailCheckInDto>
{
    private readonly UtanvegaDbContext _dbContext;

    public CheckInToTrailHandler(UtanvegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TrailCheckInDto> Handle(CheckInToTrailCommand request, CancellationToken cancellationToken)
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

        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddHours(4);
        var existing = await _dbContext.TrailCheckIns
            .FirstOrDefaultAsync(
                c => c.TrailId == trail.Id && c.UserId == request.UserId,
                cancellationToken
            );

        TrailCheckIn checkIn;
        if (existing is null)
        {
            checkIn = new TrailCheckIn
            {
                Id = Guid.NewGuid(),
                TrailId = trail.Id,
                UserId = request.UserId,
                CreatedAt = now,
                UpdatedAt = now,
                ExpiresAt = expiresAt,
            };
            _dbContext.TrailCheckIns.Add(checkIn);
        }
        else
        {
            existing.UpdatedAt = now;
            existing.ExpiresAt = expiresAt;
            checkIn = existing;
        }

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg && pg.SqlState == "23505")
        {
            // Concurrent check-in race: another request inserted the row first.
            if (existing is null)
            {
                if (_dbContext.Entry(checkIn).State == EntityState.Added)
                {
                    _dbContext.Entry(checkIn).State = EntityState.Detached;
                }

                var concurrent = await _dbContext.TrailCheckIns
                    .FirstOrDefaultAsync(c => c.TrailId == trail.Id && c.UserId == request.UserId, cancellationToken);
                if (concurrent is null)
                {
                    throw;
                }

                concurrent.UpdatedAt = now;
                concurrent.ExpiresAt = expiresAt;
                await _dbContext.SaveChangesAsync(cancellationToken);
                checkIn = concurrent;
            }
            else
            {
                throw;
            }
        }

        var profile = await _dbContext.Profiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == request.UserId, cancellationToken);
        var displayName = profile?.DisplayName;
        if (string.IsNullOrWhiteSpace(displayName))
        {
            displayName = $"Runner-{request.UserId.ToString("N")[..6]}";
        }

        return new TrailCheckInDto(
            checkIn.Id,
            checkIn.TrailId,
            checkIn.UserId,
            displayName,
            profile?.AvatarUrl,
            checkIn.UpdatedAt,
            checkIn.ExpiresAt
        );
    }
}

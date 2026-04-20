using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrailGpx;

public record UpdateTrailGpxResult(
    double Length,
    double ElevationGain,
    double ElevationLoss,
    string DetectedType,
    string Difficulty
);

public record UpdateTrailGpxCommand(Guid TrailId, string GpxXml) : IRequest<UpdateTrailGpxResult?>;

public class UpdateTrailGpxCommandHandler : IRequestHandler<UpdateTrailGpxCommand, UpdateTrailGpxResult?>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateTrailGpxCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<UpdateTrailGpxResult?> Handle(UpdateTrailGpxCommand request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .FirstOrDefaultAsync(t => t.Id == request.TrailId, cancellationToken);

        if (trail == null) return null;

        var result = GpxProcessor.Process(request.GpxXml);

        trail.GpxData = result.GpxData;
        trail.Length = result.Length;
        trail.ElevationGain = result.ElevationGain;
        trail.ElevationLoss = result.ElevationLoss;
        trail.Type = result.DetectedType;
        trail.Difficulty = result.Difficulty;
        trail.UpdatedAt = DateTime.UtcNow;
        trail.UpdatedBy = "admin";

        await _context.SaveChangesWithAuditAsync("admin");
        _cacheInvalidator.InvalidateTrail(trail.Slug);

        return new UpdateTrailGpxResult(
            trail.Length,
            trail.ElevationGain,
            trail.ElevationLoss,
            trail.Type.ToString(),
            trail.Difficulty.ToString()
        );
    }
}

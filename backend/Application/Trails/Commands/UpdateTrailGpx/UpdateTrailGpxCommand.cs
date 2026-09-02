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

public record UpdateTrailGpxCommand(Guid TrailId, string GpxXml, string? ActorUserId = null) : IRequest<UpdateTrailGpxResult?>;

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
        trail.ElevationProfile = result.ElevationProfile;
        trail.Type = result.DetectedType;
        trail.Difficulty = result.Difficulty;

        // Decision: TerrainType is deliberately left untouched on a GPX replace, not recomputed.
        // Unlike Type/Difficulty (auto-detected every time), TerrainType may have been set by an
        // admin's manual "Auto suggest" click or by the detect-terrain-types backfill, and a GPX
        // replace (e.g. a corrected track) should not silently discard that. If this ever needs
        // to recompute, it must only fill in TerrainType when it was null — never overwrite an
        // existing value — to match the "never silently overwrite a manual value" rule that
        // applies to create as well.
        trail.UpdatedAt = DateTime.UtcNow;
        trail.UpdatedBy = request.ActorUserId;

        await _context.SaveChangesWithAuditAsync(request.ActorUserId);
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

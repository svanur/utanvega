using MediatR;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

public record CreateTrailFromGpxResult(Guid Id, string Slug, string Name, string DetectedType, List<TrailSimilarityMatch> Matches, List<DetectedLocationResult> DetectedLocations);

public record TrailSimilarityMatch(Guid TrailId, string TrailName, double MatchPercentage);

public record DetectedLocationResult(Guid Id, string Name, string Type, string Role, double DistanceMeters);

public record CreateTrailFromGpxCommand(string? Name, string GpxXml, ActivityType ActivityType, string? ActorUserId = null) : IRequest<CreateTrailFromGpxResult>;

public class CreateTrailFromGpxCommandHandler : IRequestHandler<CreateTrailFromGpxCommand, CreateTrailFromGpxResult>
{
    private readonly UtanvegaDbContext _context;
    private readonly LocationDetector _locationDetector;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreateTrailFromGpxCommandHandler(UtanvegaDbContext context, LocationDetector locationDetector, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _locationDetector = locationDetector;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<CreateTrailFromGpxResult> Handle(CreateTrailFromGpxCommand request, CancellationToken cancellationToken)
    {
        var trail = ProcessGpx(request.Name, request.GpxXml, request.ActivityType);

        var matches = await CheckSimilarityAsync(trail, cancellationToken);

        // Ensure slug is unique
        while (await _context.Trails.AnyAsync(t => t.Slug == trail.Slug, cancellationToken))
        {
            trail.Slug += "-" + Guid.NewGuid().ToString()[..4];
        }

        _context.Trails.Add(trail);

        // Auto-detect and link locations by sampling the entire route
        var detectedLocations = await _locationDetector.DetectAndLinkAsync(trail, cancellationToken);

        await _context.SaveChangesWithAuditAsync(request.ActorUserId);
        _cacheInvalidator.InvalidateTrail(trail.Slug);
        
        return new CreateTrailFromGpxResult(
            trail.Id, trail.Slug, trail.Name, trail.Type.ToString(), matches,
            detectedLocations.Select(d => new DetectedLocationResult(d.Id, d.Name, d.Type, d.Role.ToString(), d.DistanceMeters)).ToList()
        );
    }

    public async Task<List<TrailSimilarityMatch>> CheckSimilarityAsync(Trail trail, CancellationToken cancellationToken)
    {
        var matches = new List<TrailSimilarityMatch>();
        
        if (trail.GpxData == null) return matches;

        // Simple buffer-based overlap check
        // We'll consider a trail a match if it's within 20 meters of the new trail
        // This is a rough estimation of "part of this trail exists"
        // Note: 0.0002 is approx 20m in degrees. For better precision, use ST_Transform to a local SRID or use geography.
        var buffer = trail.GpxData.Buffer(0.0002); 
        
        var trailLength = trail.GpxData.Length;
        if (trailLength > 0)
        {
            var existingTrails = await _context.Trails
                .Where(t => t.GpxData != null && t.GpxData.Intersects(buffer))
                .Select(t => new { t.Id, t.Name, t.GpxData })
                .ToListAsync(cancellationToken);

            foreach (var existing in existingTrails)
            {
                if (existing.GpxData == null) continue;

                // Calculate overlap percentage
                // Intersection(existing, buffer) / trail.GpxData.Length (percentage of NEW trail that's in existing)
                var intersection = existing.GpxData.Intersection(buffer);
                var matchPercentage = (intersection.Length / trailLength) * 100;

                if (matchPercentage > 5) // Threshold to report match
                {
                    matches.Add(new TrailSimilarityMatch(
                        existing.Id,
                        existing.Name,
                        Math.Round(matchPercentage, 0)
                    ));
                }
            }
        }

        return matches;
    }

    public Trail ProcessGpx(string? name, string gpxXml, ActivityType activityType) =>
        ProcessGpx(name, gpxXml, (ActivityType?)activityType, out _);

    // Used by the similarity-check paths, which don't persist the resulting Trail and so
    // don't need a real ActivityType — but do need the type detected from the GPX <type>
    // element, to surface it back to the frontend for prefill before the actual create call.
    public (Trail Trail, ActivityType? DetectedActivityType) ProcessGpxWithDetection(string? name, string gpxXml)
    {
        var trail = ProcessGpx(name, gpxXml, null, out var detectedActivityType);
        return (trail, detectedActivityType);
    }

    private Trail ProcessGpx(string? name, string gpxXml, ActivityType? activityType, out ActivityType? detectedActivityType)
    {
        var result = GpxProcessor.Process(gpxXml, name);
        detectedActivityType = result.DetectedActivityType;
        var finalName = name ?? result.ExtractedName ?? "Unnamed Trail";
        var slug = SlugGenerator.Generate(finalName);

        // Mirrors detect-terrain-types' skip condition (Length <= 1000, degenerate profile) so a
        // newly created trail is classified up front instead of needing a manual Auto suggest
        // click or a later backfill run.
        TerrainType? terrainType = null;
        if (result.Length > 1000 && !ElevationProfileValidator.IsDegenerate(result.ElevationProfile))
        {
            var maxAltitude = ElevationProfileValidator.GetMaxAltitude(result.ElevationProfile)!.Value;
            terrainType = MountainIndexClassifier.Classify(result.Length, result.ElevationGain, maxAltitude);
        }

        return new Trail
        {
            Name = finalName,
            Slug = slug,
            GpxData = result.GpxData,
            Length = result.Length,
            ElevationGain = result.ElevationGain,
            ElevationLoss = result.ElevationLoss,
            ElevationProfile = result.ElevationProfile,
            Type = result.DetectedType,
            Difficulty = result.Difficulty,
            TerrainType = terrainType,
            ActivityTypeId = activityType ?? result.DetectedActivityType ?? ActivityType.TrailRunning,
            Status = TrailStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };
    }
}

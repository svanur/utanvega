using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.BackfillElevationProfiles;

/// <summary>
/// Computes and stores <see cref="Core.Entities.Trail.ElevationProfile"/> for every trail whose
/// GPX geometry is intact but whose profile cache was never populated. Processes candidates in
/// batches so a mid-run failure (e.g. transient DB error) leaves already-completed batches
/// committed, and so the full set of matching geometries is never held in memory at once.
/// </summary>
public record BackfillElevationProfilesCommand(int BatchSize = 25) : IRequest<BackfillElevationProfilesResult>;

/// <summary>
/// Honest accounting of what the backfill actually did: <see cref="Updated"/> is the number of
/// trails whose profile was set and saved, <see cref="Skipped"/> is everything else, broken down
/// by <see cref="SkipReasons"/> so an operator can tell "not a LineString" apart from "degenerate
/// profile" without re-running with debug logging.
/// </summary>
public record BackfillElevationProfilesResult(
    int Updated,
    int Skipped,
    IReadOnlyDictionary<string, int> SkipReasons);

public class BackfillElevationProfilesCommandHandler
    : IRequestHandler<BackfillElevationProfilesCommand, BackfillElevationProfilesResult>
{
    public const string ReasonNotLineString = "not a LineString";
    public const string ReasonTooFewElevationPoints = "fewer than 2 elevation points";
    public const string ReasonDegenerateProfile = "degenerate profile";

    private readonly UtanvegaDbContext _context;

    public BackfillElevationProfilesCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<BackfillElevationProfilesResult> Handle(
        BackfillElevationProfilesCommand request, CancellationToken cancellationToken)
    {
        var batchSize = request.BatchSize > 0 ? request.BatchSize : 25;

        // Cheap first pass: IDs only, no geometry — so we never hold every matching trail's
        // full LineStringZ in memory at once, even before batching kicks in.
        var candidateIds = await _context.Trails
            .AsNoTracking()
            .Where(t => t.GpxData != null && t.ElevationProfile == null)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        var updated = 0;
        var skipReasons = new Dictionary<string, int>
        {
            [ReasonNotLineString] = 0,
            [ReasonTooFewElevationPoints] = 0,
            [ReasonDegenerateProfile] = 0,
        };

        foreach (var batchIds in candidateIds.Chunk(batchSize))
        {
            var trails = await _context.Trails
                .Where(t => batchIds.Contains(t.Id))
                .ToListAsync(cancellationToken);

            foreach (var trail in trails)
            {
                var line = trail.GpxData as LineString;
                if (line == null)
                {
                    skipReasons[ReasonNotLineString]++;
                    continue;
                }

                var elevations = line.Coordinates
                    .Select(c => c.Z)
                    .Where(z => !double.IsNaN(z))
                    .ToArray();

                if (elevations.Length < 2)
                {
                    skipReasons[ReasonTooFewElevationPoints]++;
                    continue;
                }

                var profile = SampleProfile(elevations, 50);
                if (ElevationProfileValidator.IsDegenerate(profile))
                {
                    skipReasons[ReasonDegenerateProfile]++;
                    continue;
                }

                trail.ElevationProfile = profile;
                updated++;
            }

            // Commit this batch before loading the next — a failure partway through the run
            // leaves prior batches' work saved instead of rolling back everything.
            await _context.SaveChangesAsync(cancellationToken);
        }

        return new BackfillElevationProfilesResult(updated, skipReasons.Values.Sum(), skipReasons);
    }

    private static double[] SampleProfile(double[] src, int n)
    {
        if (src.Length <= n) return src;
        var result = new double[n];
        for (var i = 0; i < n; i++)
        {
            var idx = (double)i / (n - 1) * (src.Length - 1);
            var lo = (int)idx;
            var hi = Math.Min(lo + 1, src.Length - 1);
            result[i] = src[lo] * (1 - (idx - lo)) + src[hi] * (idx - lo);
        }
        return result;
    }
}

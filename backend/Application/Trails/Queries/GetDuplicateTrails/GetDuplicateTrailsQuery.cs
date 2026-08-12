using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetDuplicateTrails;

public record DuplicatePair(Guid TrailAId, string TrailAName, Guid TrailBId, string TrailBName, double MatchPercentage);

public record GetDuplicateTrailsQuery(double Threshold = 95) : IRequest<List<DuplicatePair>>;

public class GetDuplicateTrailsQueryHandler : IRequestHandler<GetDuplicateTrailsQuery, List<DuplicatePair>>
{
    private readonly UtanvegaDbContext _context;
    private readonly ILogger<GetDuplicateTrailsQueryHandler> _logger;

    public GetDuplicateTrailsQueryHandler(UtanvegaDbContext context, ILogger<GetDuplicateTrailsQueryHandler> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<DuplicatePair>> Handle(GetDuplicateTrailsQuery request, CancellationToken cancellationToken)
    {
        var lengthFloor = request.Threshold - 20;

        // Let PostGIS find spatially-close candidate pairs server-side (bounding-box overlap via
        // `&&`, accelerated by the GiST index on GpxData) instead of pulling every trail's
        // geometry into memory and comparing all O(n^2) pairs in .NET.
        // EF Core's SqlQuery<T>(FormattableString) parameterizes interpolated values ($1, $2, …)
        // — this is NOT raw string concatenation and is safe from SQL injection.
        var candidates = await _context.Database
            .SqlQuery<CandidatePairRow>($"""
                SELECT a."Id" AS "AId", a."Name" AS "AName", a."Length" AS "ALength",
                       b."Id" AS "BId", b."Name" AS "BName", b."Length" AS "BLength"
                FROM "Trails" a
                JOIN "Trails" b ON a."Id" < b."Id"
                WHERE a."GpxData" IS NOT NULL AND b."GpxData" IS NOT NULL
                  AND a."Status" != 'Archived' AND b."Status" != 'Archived'
                  AND a."GpxData" && b."GpxData"
                  AND (a."Length" <= 0 OR b."Length" <= 0
                       OR (LEAST(a."Length", b."Length") / GREATEST(a."Length", b."Length") * 100) >= {lengthFloor})
            """)
            .ToListAsync(cancellationToken);

        _logger.LogInformation("Duplicate check: {CandidateCount} spatial candidate pairs, threshold={Threshold}%", candidates.Count, request.Threshold);

        if (candidates.Count == 0) return [];

        // Only fetch full geometries for trails that actually appear in a candidate pair.
        var trailIds = candidates.Select(c => c.AId).Concat(candidates.Select(c => c.BId)).Distinct().ToList();
        var geometries = await _context.Trails
            .Where(t => trailIds.Contains(t.Id))
            .Select(t => new { t.Id, t.GpxData })
            .ToDictionaryAsync(t => t.Id, t => t.GpxData, cancellationToken);

        var duplicates = new List<DuplicatePair>();

        foreach (var c in candidates)
        {
            if (!geometries.TryGetValue(c.AId, out var aGpx) || aGpx == null) continue;
            if (!geometries.TryGetValue(c.BId, out var bGpx) || bGpx == null) continue;

            var buffer = aGpx.Buffer(0.0002); // ~20m buffer
            if (!bGpx.Intersects(buffer)) continue;

            var aLength = aGpx.Length;
            var bLength = bGpx.Length;
            if (aLength == 0 || bLength == 0) continue;

            // Calculate how much of B lies within A's buffer
            var bInA = bGpx.Intersection(buffer);
            var bInAPercent = (bInA.Length / bLength) * 100;

            // Calculate how much of A lies within B's buffer
            var bufferB = bGpx.Buffer(0.0002);
            var aInB = aGpx.Intersection(bufferB);
            var aInBPercent = (aInB.Length / aLength) * 100;

            // Use the minimum of both directions — both trails must overlap
            var match = Math.Min(bInAPercent, aInBPercent);

            if (match >= request.Threshold)
            {
                duplicates.Add(new DuplicatePair(c.AId, c.AName, c.BId, c.BName, Math.Round(match, 0)));
            }
        }

        _logger.LogInformation("Found {DuplicateCount} duplicate pairs", duplicates.Count);
        return duplicates.OrderByDescending(d => d.MatchPercentage).ToList();
    }
}

internal class CandidatePairRow
{
    public Guid AId { get; set; }
    public string AName { get; set; } = "";
    public double ALength { get; set; }
    public Guid BId { get; set; }
    public string BName { get; set; } = "";
    public double BLength { get; set; }
}

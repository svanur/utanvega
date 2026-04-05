using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetDuplicateTrails;

public record DuplicatePair(Guid TrailAId, string TrailAName, Guid TrailBId, string TrailBName, double MatchPercentage);

public record GetDuplicateTrailsQuery(double Threshold = 95) : IRequest<List<DuplicatePair>>;

public class GetDuplicateTrailsQueryHandler : IRequestHandler<GetDuplicateTrailsQuery, List<DuplicatePair>>
{
    private readonly UtanvegaDbContext _context;

    public GetDuplicateTrailsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<DuplicatePair>> Handle(GetDuplicateTrailsQuery request, CancellationToken cancellationToken)
    {
        var trails = await _context.Trails
            .Where(t => t.GpxData != null && t.Status != Core.Entities.TrailStatus.Deleted)
            .Select(t => new { t.Id, t.Name, t.GpxData, t.Length })
            .ToListAsync(cancellationToken);

        Console.WriteLine($"[INFO] Duplicate check: {trails.Count} trails, threshold={request.Threshold}%");

        var duplicates = new List<DuplicatePair>();
        var seen = new HashSet<string>();

        for (int i = 0; i < trails.Count; i++)
        {
            for (int j = i + 1; j < trails.Count; j++)
            {
                var a = trails[i];
                var b = trails[j];

                if (a.GpxData == null || b.GpxData == null) continue;

                // Quick pre-check: if trail lengths differ by >50%, skip expensive geometry ops
                if (a.Length > 0 && b.Length > 0)
                {
                    var lengthRatio = Math.Min(a.Length, b.Length) / Math.Max(a.Length, b.Length) * 100;
                    if (lengthRatio < request.Threshold - 20) continue;
                }

                // Quick pre-check: skip if bounding boxes don't overlap
                if (!a.GpxData.EnvelopeInternal.Intersects(b.GpxData.EnvelopeInternal)) continue;

                var buffer = a.GpxData.Buffer(0.0002); // ~20m buffer
                if (!b.GpxData.Intersects(buffer)) continue;

                var aLength = a.GpxData.Length;
                var bLength = b.GpxData.Length;
                if (aLength == 0 || bLength == 0) continue;

                // Calculate how much of B lies within A's buffer
                var bInA = b.GpxData.Intersection(buffer);
                var bInAPercent = (bInA.Length / bLength) * 100;

                // Calculate how much of A lies within B's buffer
                var bufferB = b.GpxData.Buffer(0.0002);
                var aInB = a.GpxData.Intersection(bufferB);
                var aInBPercent = (aInB.Length / aLength) * 100;

                // Use the minimum of both directions — both trails must overlap
                var match = Math.Min(bInAPercent, aInBPercent);

                if (match >= request.Threshold)
                {
                    var key = $"{a.Id}-{b.Id}";
                    if (seen.Add(key))
                    {
                        duplicates.Add(new DuplicatePair(
                            a.Id, a.Name,
                            b.Id, b.Name,
                            Math.Round(match, 0)
                        ));
                    }
                }
            }
        }

        Console.WriteLine($"[INFO] Found {duplicates.Count} duplicate pairs");
        return duplicates.OrderByDescending(d => d.MatchPercentage).ToList();
    }
}

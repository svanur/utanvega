using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using NetTopologySuite.Geometries;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGeometries;

public record TrailGeometryFeature(string Slug, string ActivityType, double[][] Coordinates);

public record GetTrailGeometriesQuery : IRequest<List<TrailGeometryFeature>>, ICacheable
{
    public string CacheKey => CacheKeys.GeometriesAll;
    public TimeSpan CacheDuration => TimeSpan.FromHours(24);
}

public class GetTrailGeometriesQueryHandler : IRequestHandler<GetTrailGeometriesQuery, List<TrailGeometryFeature>>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailGeometriesQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<TrailGeometryFeature>> Handle(GetTrailGeometriesQuery request, CancellationToken cancellationToken)
    {
        // Use raw SQL to leverage PostGIS ST_Simplify for efficient geometry simplification.
        // A single fixed tolerance doesn't work across trail scales: 0.0005 degrees (~50m) is a
        // sensible cut for a 50+ km ultra route but is comparable to (or larger than) the entire
        // extent of a short, tightly-looping trail, which collapses it into a handful of
        // out-of-order points (#1323). Instead, scale the tolerance to 0.1% of each trail's own
        // "Length" (meters, precomputed on the entity — see Trail.cs), using the same ~0.00001
        // degrees-per-meter conversion the old fixed value implied, capped at the original 0.0005
        // degrees so long routes keep the same reduction they had before. Trails with no usable
        // length signal fall back to the raw (unsimplified) geometry rather than guessing a scale.
        var results = await _context.Database
            .SqlQuery<SimplifiedTrailRow>($"""
                SELECT "Slug", CAST("ActivityTypeId" AS TEXT) AS "ActivityType",
                       ST_AsGeoJSON(
                           CASE
                               WHEN "Length" IS NULL OR "Length" <= 0 THEN "GpxData"
                               ELSE ST_Simplify("GpxData", LEAST("Length" * 0.00000001, 0.0005))
                           END
                       ) AS "GeoJson"
                FROM "Trails"
                -- EventOnly mirrors GetTrailBySlugQuery's allow-list (#1321): a trail attached only
                -- to a race shouldn't show its map pin without its route line (#1534).
                WHERE "Status" IN ('Published', 'EventOnly') AND "GpxData" IS NOT NULL
            """)
            .ToListAsync(cancellationToken);

        var features = new List<TrailGeometryFeature>();

        foreach (var row in results)
        {
            if (string.IsNullOrEmpty(row.GeoJson)) continue;

            var coordinates = ParseGeoJsonCoordinates(row.GeoJson);
            if (coordinates.Length > 0)
            {
                features.Add(new TrailGeometryFeature(row.Slug, row.ActivityType, coordinates));
            }
        }

        return features;
    }

    /// <summary>
    /// Extracts coordinate pairs [lat, lng] from a GeoJSON LineString.
    /// Input GeoJSON uses [lon, lat, ele] — we flip to [lat, lng] for Leaflet.
    /// </summary>
    private static double[][] ParseGeoJsonCoordinates(string geoJson)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(geoJson);
            var coords = doc.RootElement.GetProperty("coordinates");
            var result = new List<double[]>();

            foreach (var point in coords.EnumerateArray())
            {
                var values = new List<double>();
                foreach (var v in point.EnumerateArray())
                    values.Add(v.GetDouble());

                if (values.Count >= 2)
                    result.Add(new[] { values[1], values[0] }); // [lat, lng]
            }

            return result.ToArray();
        }
        catch
        {
            return Array.Empty<double[]>();
        }
    }
}

internal class SimplifiedTrailRow
{
    public string Slug { get; set; } = "";
    public string ActivityType { get; set; } = "";
    public string? GeoJson { get; set; }
}

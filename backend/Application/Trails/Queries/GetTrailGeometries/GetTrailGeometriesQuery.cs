using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using NetTopologySuite.Geometries;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGeometries;

public record TrailGeometryFeature(string Slug, string ActivityType, double[][] Coordinates);

public record GetTrailGeometriesQuery : IRequest<List<TrailGeometryFeature>>;

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
        // Tolerance 0.0005 degrees (~50m) preserves visual shape while reducing coordinate count.
        var results = await _context.Database
            .SqlQuery<SimplifiedTrailRow>($"""
                SELECT "Slug", CAST("ActivityTypeId" AS TEXT) AS "ActivityType",
                       ST_AsGeoJSON(ST_Simplify("GpxData", 0.0005)) AS "GeoJson"
                FROM "Trails"
                WHERE "Status" = 'Published' AND "GpxData" IS NOT NULL
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

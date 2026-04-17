using NetTopologySuite.Geometries;
using System.Xml.Linq;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Core.Services;

public record GpxProcessResult(
    LineString GpxData,
    double Length,
    double ElevationGain,
    double ElevationLoss,
    TrailType DetectedType,
    Difficulty Difficulty,
    string? ExtractedName
);

public static class GpxProcessor
{
    private static readonly GeometryFactory GeometryFactory = new(new PrecisionModel(), 4326);

    public static GpxProcessResult Process(string gpxXml, string? nameOverride = null)
    {
        XDocument doc;
        try
        {
            doc = XDocument.Parse(gpxXml);
        }
        catch (Exception ex)
        {
            throw new Exception("Invalid GPX XML format", ex);
        }

        XNamespace ns = doc.Root?.GetDefaultNamespace() ?? "http://www.topografix.com/GPX/1/1";

        string? extractedName = null;
        if (string.IsNullOrWhiteSpace(nameOverride))
        {
            var nameElement = doc.Descendants(ns + "metadata").Elements(ns + "name").FirstOrDefault()
                             ?? doc.Descendants(ns + "name").FirstOrDefault();
            extractedName = nameElement?.Value?.Trim();
        }

        var points = doc.Descendants(ns + "trkpt")
            .Select(p =>
            {
                var latStr = p.Attribute("lat")?.Value ?? "0";
                var lonStr = p.Attribute("lon")?.Value ?? "0";
                var eleElement = p.Element(ns + "ele") ?? p.Elements().FirstOrDefault(e => e.Name.LocalName == "ele");
                var eleStr = eleElement?.Value ?? "0";

                if (!double.TryParse(latStr, System.Globalization.CultureInfo.InvariantCulture, out var lat)) lat = 0;
                if (!double.TryParse(lonStr, System.Globalization.CultureInfo.InvariantCulture, out var lon)) lon = 0;
                if (!double.TryParse(eleStr, System.Globalization.CultureInfo.InvariantCulture, out var ele)) ele = 0;

                return new { Lat = lat, Lon = lon, Ele = ele };
            })
            .ToList();

        if (points.Count == 0)
            throw new Exception("No points found in GPX");

        var coordinates = points.Select(p => new CoordinateZ(p.Lon, p.Lat, p.Ele)).ToArray();
        var lineString = GeometryFactory.CreateLineString(coordinates);

        double length = 0, gain = 0, loss = 0;
        for (var i = 1; i < points.Count; i++)
        {
            var p1 = points[i - 1];
            var p2 = points[i];
            length += CalculateDistance(p1.Lat, p1.Lon, p2.Lat, p2.Lon);

            var diff = p2.Ele - p1.Ele;
            if (diff > 0) gain += diff;
            else loss += Math.Abs(diff);
        }

        var detectedType = TrailTypeDetector.Detect(lineString, length);
        var difficulty = DifficultyCalculator.Calculate(length, gain, ActivityType.TrailRunning);

        return new GpxProcessResult(lineString, length, gain, loss, detectedType, difficulty, extractedName);
    }

    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        var d1 = lat1 * (Math.PI / 180.0);
        var num1 = lon1 * (Math.PI / 180.0);
        var d2 = lat2 * (Math.PI / 180.0);
        var num2 = lon2 * (Math.PI / 180.0) - num1;
        var d3 = Math.Pow(Math.Sin((d2 - d1) / 2.0), 2.0) + Math.Cos(d1) * Math.Cos(d2) * Math.Pow(Math.Sin(num2 / 2.0), 2.0);
        return 6371000.0 * (2.0 * Math.Atan2(Math.Sqrt(d3), Math.Sqrt(1.0 - d3)));
    }
}

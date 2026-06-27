using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

public class GpxProcessorTests
{
    // ─── Minimal valid GPX builder ───

    private static string BuildGpx(IEnumerable<(double lat, double lon, double ele)> points, string? name = null)
    {
        var trkpts = string.Concat(points.Select(p =>
            $"<trkpt lat=\"{p.lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}\" " +
            $"lon=\"{p.lon.ToString(System.Globalization.CultureInfo.InvariantCulture)}\">" +
            $"<ele>{p.ele.ToString(System.Globalization.CultureInfo.InvariantCulture)}</ele></trkpt>"));

        var namePart = name is not null ? $"<metadata><name>{name}</name></metadata>" : "";
        return $"<?xml version=\"1.0\"?><gpx xmlns=\"http://www.topografix.com/GPX/1/1\">{namePart}<trk><trkseg>{trkpts}</trkseg></trk></gpx>";
    }

    // ─── Elevation profile sampling ───

    [Fact]
    public void ElevationProfile_FewerPointsThanTarget_ReturnsAllPoints()
    {
        var points = Enumerable.Range(0, 10)
            .Select(i => (64.0 + i * 0.001, -18.0 + i * 0.001, (double)(100 + i)));
        var result = GpxProcessor.Process(BuildGpx(points));

        Assert.NotNull(result.ElevationProfile);
        Assert.Equal(10, result.ElevationProfile!.Length);
    }

    [Fact]
    public void ElevationProfile_MorePointsThanTarget_DownsamplesTo50()
    {
        var points = Enumerable.Range(0, 200)
            .Select(i => (64.0 + i * 0.0001, -18.0 + i * 0.0001, (double)(100 + i)));
        var result = GpxProcessor.Process(BuildGpx(points));

        Assert.NotNull(result.ElevationProfile);
        Assert.Equal(50, result.ElevationProfile!.Length);
    }

    [Fact]
    public void ElevationProfile_FirstAndLastPointsPreserved()
    {
        var points = Enumerable.Range(0, 100)
            .Select(i => (64.0 + i * 0.0001, -18.0 + i * 0.0001, (double)(i * 10)));
        var result = GpxProcessor.Process(BuildGpx(points));

        Assert.NotNull(result.ElevationProfile);
        Assert.Equal(0.0, result.ElevationProfile![0], precision: 1);
        Assert.Equal(990.0, result.ElevationProfile![^1], precision: 1);
    }

    [Fact]
    public void ElevationProfile_FlatTerrain_AllSameValue()
    {
        var points = Enumerable.Range(0, 100)
            .Select(i => (64.0 + i * 0.0001, -18.0 + i * 0.0001, 500.0));
        var result = GpxProcessor.Process(BuildGpx(points));

        Assert.NotNull(result.ElevationProfile);
        Assert.All(result.ElevationProfile!, e => Assert.Equal(500.0, e, precision: 3));
    }

    // ─── Elevation gain/loss calculation ───

    [Fact]
    public void ElevationGain_OnlyCountsAscent()
    {
        // 0 → 100 → 50 → 150 → gain = 100 + 100 = 200, loss = 50
        var points = new[]
        {
            (64.00, -18.00, 0.0),
            (64.01, -18.00, 100.0),
            (64.02, -18.00, 50.0),
            (64.03, -18.00, 150.0),
        };
        var result = GpxProcessor.Process(BuildGpx(points));

        Assert.Equal(200.0, result.ElevationGain, precision: 1);
        Assert.Equal(50.0, result.ElevationLoss, precision: 1);
    }

    [Fact]
    public void FlatRoute_HasZeroGainAndLoss()
    {
        var points = new[]
        {
            (64.00, -18.00, 100.0),
            (64.01, -18.00, 100.0),
            (64.02, -18.00, 100.0),
        };
        var result = GpxProcessor.Process(BuildGpx(points));

        Assert.Equal(0.0, result.ElevationGain, precision: 3);
        Assert.Equal(0.0, result.ElevationLoss, precision: 3);
    }

    // ─── Name extraction ───

    [Fact]
    public void NameOverride_TakesPrecedenceOverGpxName()
    {
        var gpx = BuildGpx([(64.0, -18.0, 0.0), (64.01, -18.01, 0.0)], name: "GPX Name");
        var result = GpxProcessor.Process(gpx, nameOverride: "My Override");

        Assert.Null(result.ExtractedName);
    }

    [Fact]
    public void NoNameOverride_ExtractsFromGpxMetadata()
    {
        var gpx = BuildGpx([(64.0, -18.0, 0.0), (64.01, -18.01, 0.0)], name: "Laugavegur");
        var result = GpxProcessor.Process(gpx);

        Assert.Equal("Laugavegur", result.ExtractedName);
    }

    // ─── Error handling ───

    [Fact]
    public void InvalidXml_ThrowsException()
    {
        Assert.Throws<Exception>(() => GpxProcessor.Process("not xml"));
    }

    [Fact]
    public void NoTrackPoints_ThrowsException()
    {
        var gpx = "<?xml version=\"1.0\"?><gpx xmlns=\"http://www.topografix.com/GPX/1/1\"><trk><trkseg></trkseg></trk></gpx>";
        Assert.Throws<Exception>(() => GpxProcessor.Process(gpx));
    }

    // ─── Distance calculation (sanity check) ───

    [Fact]
    public void Length_IsPositiveForNonTrivialRoute()
    {
        var points = new[]
        {
            (64.00, -18.00, 0.0),
            (64.10, -18.10, 0.0),
            (64.20, -18.20, 0.0),
        };
        var result = GpxProcessor.Process(BuildGpx(points));

        Assert.True(result.Length > 0);
    }
}

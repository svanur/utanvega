using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

// Backs both the MaxAltitude projection (Program.cs) and the detect-terrain-types endpoint's
// skip condition — the same IsDegenerate/GetMaxAltitude result decides "MaxAltitude is null"
// and "this trail is skipped, not updated" for the same underlying profile shape.
public class ElevationProfileValidatorTests
{
    [Fact]
    public void IsDegenerate_NullProfile_ReturnsTrue()
    {
        Assert.True(ElevationProfileValidator.IsDegenerate(null));
    }

    [Fact]
    public void IsDegenerate_EmptyProfile_ReturnsTrue()
    {
        Assert.True(ElevationProfileValidator.IsDegenerate([]));
    }

    [Fact]
    public void IsDegenerate_AllZeroProfile_ReturnsTrue()
    {
        Assert.True(ElevationProfileValidator.IsDegenerate([0, 0, 0, 0]));
    }

    [Fact]
    public void IsDegenerate_SinglePointProfile_ReturnsTrue()
    {
        Assert.True(ElevationProfileValidator.IsDegenerate([250.0]));
    }

    [Fact]
    public void IsDegenerate_RepeatedNonZeroValue_ReturnsTrue()
    {
        // Fewer than 2 distinct values — even nonzero, this can't be real GPS/barometric data.
        Assert.True(ElevationProfileValidator.IsDegenerate([500.0, 500.0, 500.0]));
    }

    [Fact]
    public void IsDegenerate_ValidVaryingProfile_ReturnsFalse()
    {
        Assert.False(ElevationProfileValidator.IsDegenerate([100.0, 150.0, 120.0, 200.0]));
    }

    [Fact]
    public void GetMaxAltitude_NullProfile_ReturnsNull()
    {
        Assert.Null(ElevationProfileValidator.GetMaxAltitude(null));
    }

    [Fact]
    public void GetMaxAltitude_AllZeroProfile_ReturnsNull()
    {
        Assert.Null(ElevationProfileValidator.GetMaxAltitude([0, 0, 0]));
    }

    [Fact]
    public void GetMaxAltitude_SinglePointProfile_ReturnsNull()
    {
        Assert.Null(ElevationProfileValidator.GetMaxAltitude([250.0]));
    }

    [Fact]
    public void GetMaxAltitude_ValidProfile_ReturnsMax()
    {
        Assert.Equal(200.0, ElevationProfileValidator.GetMaxAltitude([100.0, 150.0, 120.0, 200.0]));
    }
}

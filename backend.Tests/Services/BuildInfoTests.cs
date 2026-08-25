using Utanvega.Backend.Core;
using Xunit;

namespace Utanvega.Backend.Tests.Services;

public class BuildInfoTests
{
    // ── NormalizeVersion ──────────────────────────────────────────────────

    [Fact]
    public void NormalizeVersion_StripsSourceRevisionSuffix()
    {
        // The SDK appends "+<commit>" when it can see the repository. That is
        // not something to show in a health response.
        Assert.Equal("1.1.1", BuildInfo.NormalizeVersion("1.1.1+37fa7bea9c57e4c25e106be7f038415af5160847", null));
    }

    [Fact]
    public void NormalizeVersion_LeavesAPlainVersionAlone()
    {
        Assert.Equal("1.1.1", BuildInfo.NormalizeVersion("1.1.1", null));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void NormalizeVersion_FallsBackToAssemblyVersion_TrimmedToThreeParts(string? informational)
    {
        // Assembly.GetName().Version pads to four parts, so the fallback has to
        // trim or it would report "1.1.1.0" while the informational path
        // reports "1.1.1" — two shapes for the same build.
        Assert.Equal("1.1.1", BuildInfo.NormalizeVersion(informational, new Version(1, 1, 1, 0)));
    }

    [Fact]
    public void NormalizeVersion_ReturnsUnknown_WhenNeitherSourceIsAvailable()
    {
        Assert.Equal(BuildInfo.Unknown, BuildInfo.NormalizeVersion(null, null));
    }

    // ── NormalizeGitHash ──────────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void NormalizeGitHash_ReturnsUnknown_WhenAbsentOrBlank(string? raw)
    {
        // Docker copies the source without .git, so the SDK cannot infer the
        // commit inside the image — CI passes it via --build-arg. Absent that,
        // "unknown" is the honest answer rather than a stale or empty value.
        Assert.Equal(BuildInfo.Unknown, BuildInfo.NormalizeGitHash(raw));
    }

    [Fact]
    public void NormalizeGitHash_KeepsASuppliedCommit()
    {
        Assert.Equal("37fa7be", BuildInfo.NormalizeGitHash("37fa7be"));
    }

    [Fact]
    public void NormalizeGitHash_TrimsSurroundingWhitespace()
    {
        Assert.Equal("37fa7be", BuildInfo.NormalizeGitHash("  37fa7be\n"));
    }

    // ── The resolved values ───────────────────────────────────────────────

    [Fact]
    public void Version_IsMajorMinorPatch()
    {
        // Whichever branch produced it, the shape the health endpoints and the
        // footer rely on is the same.
        Assert.Matches(@"^\d+\.\d+\.\d+$", BuildInfo.Version);
    }
}

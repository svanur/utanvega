using System.Globalization;
using System.Text.Json;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

// Guards against the exact drift #467 was filed for: the Mountain Index thresholds living in
// more than one place (backend, admin, FAQ) and silently going out of sync. These tests read the
// actual repo files (Program.cs, en.json, is.json) rather than duplicating the numbers, so an
// edit to MountainIndexClassifier's constants without a matching FAQ/call-site edit fails CI.
public class MountainIndexFaqAndSingleSourceTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "frontend", "i18n")))
            dir = dir.Parent;

        return dir?.FullName
            ?? throw new DirectoryNotFoundException("Could not locate repo root (expected to find frontend/i18n above the test bin directory).");
    }

    private static string ReadFaqAnswer(string i18nFileName)
    {
        var path = Path.Combine(RepoRoot(), "frontend", "i18n", i18nFileName);
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement
            .GetProperty("faq")
            .GetProperty("terrainType")
            .GetProperty("a")
            .GetString()
            ?? throw new InvalidOperationException($"faq.terrainType.a missing or null in {i18nFileName}");
    }

    [Theory]
    [InlineData("en.json")]
    [InlineData("is.json")]
    public void FaqAnswer_ContainsExactCodeThresholds(string fileName)
    {
        var faqAnswer = ReadFaqAnswer(fileName);

        // Every numeric threshold used by MountainIndexClassifier must appear literally in the
        // FAQ text. If a threshold changes in code without a matching FAQ edit, this fails.
        Assert.Contains(FormatThreshold(MountainIndexClassifier.FlatRatioThreshold), faqAnswer);
        Assert.Contains(FormatThreshold(MountainIndexClassifier.HighAltitudeThreshold), faqAnswer);
        Assert.Contains(FormatThreshold(MountainIndexClassifier.HighAltitudeRatioThreshold), faqAnswer);
        Assert.Contains(FormatThreshold(MountainIndexClassifier.SteepRatioThreshold), faqAnswer);
        Assert.Contains(FormatThreshold(MountainIndexClassifier.GainThreshold), faqAnswer);
    }

    [Theory]
    [InlineData("en.json")]
    [InlineData("is.json")]
    public void FaqAnswer_MentionsAdminCanAdjustByHand(string fileName)
    {
        var faqAnswer = ReadFaqAnswer(fileName);

        // English and Icelandic phrasing differ, so this only checks the English file's exact
        // wording; the Icelandic equivalent is spot-checked in FaqAnswer_Icelandic_MentionsAdjustment.
        if (fileName == "en.json")
        {
            Assert.Contains("starting point", faqAnswer, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("adjust", faqAnswer, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void FaqAnswer_Icelandic_MentionsAdjustment()
    {
        var faqAnswer = ReadFaqAnswer("is.json");

        // "starting point" ≈ "upphafspunkt" / "útgangspunkt"; "adjust by hand" ≈ "breyta handvirkt".
        Assert.True(
            faqAnswer.Contains("upphafspunkt", StringComparison.OrdinalIgnoreCase)
            || faqAnswer.Contains("útgangspunkt", StringComparison.OrdinalIgnoreCase),
            "Expected the Icelandic FAQ answer to describe the calculation as a starting point.");
        Assert.Contains("handvirkt", faqAnswer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ProgramCs_CallsClassifierFromBothTerrainEndpoints_NotADuplicateImplementation()
    {
        var programCsPath = Path.Combine(RepoRoot(), "backend", "Program.cs");
        var source = File.ReadAllText(programCsPath);

        var callSiteCount = CountOccurrences(source, "MountainIndexClassifier.Classify(");
        Assert.True(callSiteCount >= 2,
            $"Expected detect-terrain-types and classify-terrain to both call MountainIndexClassifier.Classify(...), found {callSiteCount} call site(s).");

        // The undocumented short-circuit this issue removed must never come back.
        Assert.DoesNotContain("maxAltitude < 400", source);
    }

    private static int CountOccurrences(string haystack, string needle)
    {
        var count = 0;
        var index = 0;
        while ((index = haystack.IndexOf(needle, index, StringComparison.Ordinal)) != -1)
        {
            count++;
            index += needle.Length;
        }
        return count;
    }

    private static string FormatThreshold(double value) =>
        value.ToString("0.#", CultureInfo.InvariantCulture);
}

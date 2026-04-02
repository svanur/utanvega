using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

public class SlugGeneratorTests
{
    [Theory]
    [InlineData("Hello World", "hello-world")]
    [InlineData("  leading and trailing  ", "leading-and-trailing")]
    [InlineData("UPPERCASE TEXT", "uppercase-text")]
    [InlineData("multiple   spaces   here", "multiple-spaces-here")]
    public void Generate_BasicStrings_ReturnsExpectedSlug(string input, string expected)
    {
        Assert.Equal(expected, SlugGenerator.Generate(input));
    }

    [Theory]
    [InlineData("Öskjuhlíð", "oskjuhlid")]
    [InlineData("Þórsmörk", "thorsmork")]
    [InlineData("Æðarfoss", "aedarfoss")]
    [InlineData("Bláfjöll", "blafjoll")]
    [InlineData("Landmannalaugar", "landmannalaugar")]
    [InlineData("Reykjavík", "reykjavik")]
    [InlineData("Akureyri Ísland", "akureyri-island")]
    [InlineData("Fimmvörðuháls", "fimmvorduhals")]
    [InlineData("Ólafsvík", "olafsvik")]
    [InlineData("Hveragerði", "hveragerdi")]
    public void Generate_IcelandicCharacters_AreTransliterated(string input, string expected)
    {
        Assert.Equal(expected, SlugGenerator.Generate(input));
    }

    [Theory]
    [InlineData("trail_name", "trail-name")]
    [InlineData("trail.name", "trail-name")]
    [InlineData("trail---name", "trail-name")]
    [InlineData("--leading-dashes--", "leading-dashes")]
    public void Generate_SpecialSeparators_ConvertedToDashes(string input, string expected)
    {
        Assert.Equal(expected, SlugGenerator.Generate(input));
    }

    [Theory]
    [InlineData("café & bistro!", "cafe-bistro")]
    [InlineData("trail #1 (loop)", "trail-1-loop")]
    [InlineData("100% fun", "100-fun")]
    public void Generate_SpecialCharacters_AreStripped(string input, string expected)
    {
        Assert.Equal(expected, SlugGenerator.Generate(input));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Generate_EmptyOrNull_ReturnsEmpty(string? input)
    {
        Assert.Equal(string.Empty, SlugGenerator.Generate(input!));
    }

    [Fact]
    public void Generate_AllIcelandicLetters_AreMapped()
    {
        // Every Icelandic special character should produce a non-empty result
        var icelandic = "áéíóúýþæöð";
        var result = SlugGenerator.Generate(icelandic);
        Assert.NotEmpty(result);
        // Should not contain any of the original characters
        foreach (var c in icelandic)
            Assert.DoesNotContain(c.ToString(), result);
    }

    [Fact]
    public void Generate_UppercaseIcelandic_SameAsLowercase()
    {
        Assert.Equal(
            SlugGenerator.Generate("Öskjuhlíð"),
            SlugGenerator.Generate("ÖSKJUHLÍÐ")
        );
    }
}

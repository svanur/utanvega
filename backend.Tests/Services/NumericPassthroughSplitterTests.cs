using Utanvega.Backend.Core.Services;
using Xunit;

namespace Utanvega.Backend.Tests.Services;

public class NumericPassthroughSplitterTests
{
    [Theory]
    [InlineData("2026", true)]
    [InlineData(" 2026 ", true)]
    [InlineData("0", true)]
    [InlineData("Vetrarhlaup 2026", false)]
    [InlineData("10 km", false)]
    [InlineData("-5", false)]
    [InlineData("3.5", false)]
    [InlineData("", false)]
    [InlineData(" ", false)]
    public void IsPureNumeric_MatchesOnlyBareDigitStrings(string text, bool expected)
    {
        Assert.Equal(expected, NumericPassthroughSplitter.IsPureNumeric(text));
    }

    [Fact]
    public void IsPureNumeric_NullReturnsFalse()
    {
        Assert.False(NumericPassthroughSplitter.IsPureNumeric(null));
    }

    [Fact]
    public void Split_AllNumeric_RoutesEverythingToPassthroughAndNoneToTranslate()
    {
        var texts = new List<string> { "2026" };

        var split = NumericPassthroughSplitter.Split(texts);

        Assert.Equal(new[] { 0 }, split.PassthroughIndices);
        Assert.Empty(split.ToTranslate);
    }

    [Fact]
    public void Reassemble_AllNumeric_ReturnsOriginalTextUnchanged()
    {
        var texts = new List<string> { "2026" };
        var split = NumericPassthroughSplitter.Split(texts);

        var result = NumericPassthroughSplitter.Reassemble(texts, split, translated: new List<string>());

        Assert.Equal(new[] { "2026" }, result);
    }

    [Fact]
    public void Split_MixedTextAndNumber_TreatsEntryWithWordsAsNonNumeric()
    {
        var texts = new List<string> { "Vetrarhlaup 2026" };

        var split = NumericPassthroughSplitter.Split(texts);

        Assert.Empty(split.PassthroughIndices);
        Assert.Equal(new[] { "Vetrarhlaup 2026" }, split.ToTranslate);
    }

    [Fact]
    public void SplitThenReassemble_MixOfNumericAndProse_PreservesOriginalPositions()
    {
        // "2026" at index 0 must stay untranslated; "Hlaup" at index 1 goes through DeepL
        // (simulated here by the fake "Run" translation) and must land back at index 1.
        var texts = new List<string> { "2026", "Hlaup" };

        var split = NumericPassthroughSplitter.Split(texts);
        var fakeDeepLOutput = new List<string> { "Run" };
        var result = NumericPassthroughSplitter.Reassemble(texts, split, fakeDeepLOutput);

        Assert.Equal(new[] { "2026", "Run" }, result);
    }

    [Fact]
    public void SplitThenReassemble_NoNumericEntries_BehavesLikeFullPassThroughToDeepL()
    {
        var texts = new List<string> { "Hlaup", "Ganga" };

        var split = NumericPassthroughSplitter.Split(texts);

        Assert.Empty(split.PassthroughIndices);
        Assert.Equal(texts, split.ToTranslate);

        var fakeDeepLOutput = new List<string> { "Run", "Walk" };
        var result = NumericPassthroughSplitter.Reassemble(texts, split, fakeDeepLOutput);

        Assert.Equal(new[] { "Run", "Walk" }, result);
    }

    [Fact]
    public void Reassemble_FewerTranslatedThanExpected_ThrowsInvalidOperationExceptionNamingBothCounts()
    {
        // "Hlaup" and "Ganga" both need translation, so 2 are expected, but DeepL only returned 1 —
        // simulating a partial/truncated DeepL response. See issue #1584.
        var texts = new List<string> { "Hlaup", "Ganga" };
        var split = NumericPassthroughSplitter.Split(texts);
        var fakeDeepLOutput = new List<string> { "Run" };

        var ex = Assert.Throws<InvalidOperationException>(
            () => NumericPassthroughSplitter.Reassemble(texts, split, fakeDeepLOutput));

        Assert.Contains("2", ex.Message);
        Assert.Contains("1", ex.Message);
    }

    [Fact]
    public void Reassemble_MoreTranslatedThanExpected_ThrowsInvalidOperationExceptionNamingBothCounts()
    {
        // Only "Hlaup" needs translation (1 expected), but DeepL returned 2 — simulating an
        // over-long/misaligned DeepL response. See issue #1584.
        var texts = new List<string> { "2026", "Hlaup" };
        var split = NumericPassthroughSplitter.Split(texts);
        var fakeDeepLOutput = new List<string> { "Run", "Extra" };

        var ex = Assert.Throws<InvalidOperationException>(
            () => NumericPassthroughSplitter.Reassemble(texts, split, fakeDeepLOutput));

        Assert.Contains("1", ex.Message);
        Assert.Contains("2", ex.Message);
    }
}

using System.Text.RegularExpressions;

namespace Utanvega.Backend.Core.Services;

/// <summary>
/// Separates bare numeric strings (e.g. "2026") from the rest of a translation batch so callers
/// can skip sending them to DeepL, which otherwise spells a numeral out as words when it has no
/// surrounding text to anchor it. See issue #1581.
/// </summary>
public static partial class NumericPassthroughSplitter
{
    /// <summary>
    /// True when the trimmed text is one or more digits and nothing else. Decimals, negative
    /// signs, units, and ranges are intentionally excluded — only plain-digit strings were
    /// reported broken.
    /// </summary>
    public static bool IsPureNumeric(string? text)
    {
        return text != null && PureDigits().IsMatch(text.Trim());
    }

    /// <summary>
    /// Splits <paramref name="texts"/> into the subset that should bypass translation (pure
    /// numerals) and the subset that should still go to DeepL, each keeping its original index
    /// so the caller can reassemble the response in order.
    /// </summary>
    public static NumericPassthroughSplit Split(IReadOnlyList<string> texts)
    {
        var passthroughIndices = new List<int>();
        var toTranslateIndices = new List<int>();
        var toTranslate = new List<string>();

        for (var i = 0; i < texts.Count; i++)
        {
            if (IsPureNumeric(texts[i]))
                passthroughIndices.Add(i);
            else
            {
                toTranslateIndices.Add(i);
                toTranslate.Add(texts[i]);
            }
        }

        return new NumericPassthroughSplit(passthroughIndices, toTranslateIndices, toTranslate);
    }

    /// <summary>
    /// Rebuilds a full-length result array from the original texts (for the passthrough slots)
    /// and the DeepL output (for the translated slots), restoring original positions.
    /// </summary>
    public static List<string> Reassemble(IReadOnlyList<string> originalTexts, NumericPassthroughSplit split, IReadOnlyList<string> translated)
    {
        if (translated.Count != split.ToTranslateIndices.Count)
            throw new InvalidOperationException(
                $"Translation count mismatch: expected {split.ToTranslateIndices.Count} translated strings but got {translated.Count}.");

        var result = new string[originalTexts.Count];

        foreach (var i in split.PassthroughIndices)
            result[i] = originalTexts[i];

        for (var j = 0; j < split.ToTranslateIndices.Count; j++)
            result[split.ToTranslateIndices[j]] = translated[j];

        return result.ToList();
    }

    [GeneratedRegex(@"^\d+$")]
    private static partial Regex PureDigits();
}

/// <summary>
/// Index bookkeeping produced by <see cref="NumericPassthroughSplitter.Split"/>.
/// </summary>
public sealed record NumericPassthroughSplit(List<int> PassthroughIndices, List<int> ToTranslateIndices, List<string> ToTranslate);

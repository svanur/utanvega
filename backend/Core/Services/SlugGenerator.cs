using System.Text;
using System.Text.RegularExpressions;

namespace Utanvega.Backend.Core.Services;

public static partial class SlugGenerator
{
    private static readonly Dictionary<char, string> IcelandicMap = new()
    {
        ['á'] = "a",  ['Á'] = "a",
        ['é'] = "e",  ['É'] = "e",
        ['í'] = "i",  ['Í'] = "i",
        ['ó'] = "o",  ['Ó'] = "o",
        ['ú'] = "u",  ['Ú'] = "u",
        ['ý'] = "y",  ['Ý'] = "y",
        ['þ'] = "th", ['Þ'] = "th",
        ['æ'] = "ae", ['Æ'] = "ae",
        ['ö'] = "o",  ['Ö'] = "o",
        ['ð'] = "d",  ['Ð'] = "d",
    };

    /// <summary>
    /// Generates a URL-friendly slug from a name.
    /// Handles Icelandic characters, strips special chars, collapses dashes.
    /// </summary>
    public static string Generate(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return string.Empty;

        var sb = new StringBuilder(name.Length);
        foreach (var c in name)
        {
            if (IcelandicMap.TryGetValue(c, out var replacement))
                sb.Append(replacement);
            else
                sb.Append(c);
        }

        var slug = sb.ToString().ToLowerInvariant();

        // Replace spaces, underscores, and dots with dashes
        slug = WhitespaceAndSeparators().Replace(slug, "-");

        // Keep only alphanumeric and dashes
        slug = NonSlugChars().Replace(slug, "");

        // Collapse consecutive dashes
        slug = ConsecutiveDashes().Replace(slug, "-");

        // Trim leading/trailing dashes
        slug = slug.Trim('-');

        return slug;
    }

    [GeneratedRegex(@"[\s_\.]+")]
    private static partial Regex WhitespaceAndSeparators();

    [GeneratedRegex(@"[^a-z0-9\-]")]
    private static partial Regex NonSlugChars();

    [GeneratedRegex(@"-{2,}")]
    private static partial Regex ConsecutiveDashes();
}

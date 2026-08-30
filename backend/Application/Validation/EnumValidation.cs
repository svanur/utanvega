namespace Utanvega.Backend.Application.Validation;

public static class EnumValidation
{
    // Enum.TryParse accepts a numeric string as long as it fits the underlying type, whether or not
    // it's in range — TryParse<EditionStatus>("0", ..., out var p) succeeds with p = Active (numbered
    // 0 by declaration order), and TryParse<EditionStatus>("99", ..., out _) also returns true even
    // though no member has that value, so pairing it with Enum.IsDefined only catches the
    // out-of-range half of the problem. A status arriving as JSON should only ever be the member name
    // ("Active"), never its ordinal — matching directly against the declared names is what the
    // "must be one of: ..." validation message actually promises, and rejects both cases at once.
    public static bool IsDefined<TEnum>(string? value) where TEnum : struct, Enum =>
        value is not null && Enum.GetNames<TEnum>().Any(n => string.Equals(n, value, StringComparison.OrdinalIgnoreCase));
}

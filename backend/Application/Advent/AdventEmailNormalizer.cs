using System.Net.Mail;

namespace Utanvega.Backend.Application.Advent;

/// <summary>
/// Single place to turn a caller-supplied advent email into the exact string used as the
/// <see cref="Core.Entities.AdventEntry"/> DB key (#1875 review follow-up, issue #1880's email side).
/// The endpoints validate with <c>new MailAddress(req.Email)</c>, and that type accepts an RFC 5322
/// display-name wrapper like <c>"John Doe &lt;john@x.com&gt;"</c> as valid — if the raw string were
/// used as the key, that entrant and a plain <c>john@x.com</c> submission would collide on the same
/// mailbox but key as two different rows (two tickets, two entrants). Parsing again here and keeping
/// only <see cref="MailAddress.Address"/> strips the wrapper before normalization, so both forms
/// resolve to the same key.
/// </summary>
public static class AdventEmailNormalizer
{
    /// <summary>
    /// Lowercased, trimmed mailbox address — the display-name wrapper, if any, is discarded.
    /// Falls back to a plain trim+lowercase of <paramref name="email"/> if it doesn't parse here
    /// (it already passed <c>MailAddress</c> validation at the endpoint, so this is just defensive).
    /// </summary>
    public static string Normalize(string email)
    {
        try
        {
            return new MailAddress(email).Address.Trim().ToLowerInvariant();
        }
        catch (FormatException)
        {
            return email.Trim().ToLowerInvariant();
        }
    }
}

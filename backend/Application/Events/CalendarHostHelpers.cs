namespace Utanvega.Backend.Application.Events;

public static class CalendarHostHelpers
{
    // Single source of truth for the domain literals the calendar.ics feed's PRODID/UID are built
    // from. SiteUrl is operator-configured, not user input, but a malformed value here must not
    // take down the whole feed — before #1045 moved this Uri parse ahead of the event loop, a bad
    // SiteUrl with zero matching events still returned a valid empty feed; falling back to the
    // production literals this logic was hardcoded to before SiteUrl existed restores that.
    public static (string BareSiteHost, string ProductIdHost) ComputeCalendarHosts(string siteUrl)
    {
        string siteHost;
        try
        {
            siteHost = new Uri(siteUrl).Host;
        }
        catch (UriFormatException)
        {
            siteHost = "www.hlaupadagskra.is";
        }

        var bareSiteHost = StripWwwPrefix(siteHost);
        var productIdHost = CapitalizeFirstLetter(bareSiteHost);

        return (bareSiteHost, productIdHost);
    }

    // Strip the "www." a production SiteUrl typically carries so ProductId/Uid read as the bare
    // domain, matching what these were hardcoded to before SiteUrl existed.
    public static string StripWwwPrefix(string host) =>
        host.StartsWith("www.", StringComparison.OrdinalIgnoreCase)
            ? host["www.".Length..]
            : host;

    // Title-cases the PRODID vendor token (e.g. "hlaupadagskra.is" -> "Hlaupadagskra.is"). Skips
    // past any leading non-letters (digits, hyphens) instead of blindly uppercasing index 0, so a
    // domain like "360runs.com" reads as "360Runs.com" rather than being left untouched.
    public static string CapitalizeFirstLetter(string host)
    {
        for (var i = 0; i < host.Length; i++)
        {
            if (char.IsLetter(host[i]))
                return host[..i] + char.ToUpperInvariant(host[i]) + host[(i + 1)..];
        }

        return host; // no letters at all — nothing to capitalize
    }
}

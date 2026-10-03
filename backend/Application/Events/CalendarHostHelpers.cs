namespace Utanvega.Backend.Application.Events;

public static class CalendarHostHelpers
{
    // Default SiteUrl when configuration["SiteUrl"] is unset. Single source of truth shared by the
    // GetEventCalendarIcs endpoint and its tests so the two copies can't silently drift apart (#1077).
    public const string DefaultSiteUrl = "https://www.hlaupadagskra.is";

    // Default SiteUrlEn when configuration["SiteUrlEn"] is unset — the English-path counterpart to
    // DefaultSiteUrl above, used by the ?lang=en branch of GetEventCalendarIcs (#1161) so the
    // 360runs.com brand (already present in frontend/api/_site.ts's BRAND_NAME.en and in
    // appsettings.json's AllowedOrigins) is reflected in PRODID/Uid/Url for English subscribers too.
    public const string DefaultSiteUrlEn = "https://360runs.com";

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

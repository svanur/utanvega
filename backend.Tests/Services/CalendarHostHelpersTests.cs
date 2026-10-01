using Utanvega.Backend.Application.Events;

namespace backend.Tests.Services;

public class CalendarHostHelpersTests
{
    [Fact]
    public void ComputeCalendarHosts_WwwPrefixedProductionUrl_StripsWwwAndCapitalizes()
    {
        var (bareSiteHost, productIdHost) = CalendarHostHelpers.ComputeCalendarHosts("https://www.hlaupadagskra.is");

        Assert.Equal("hlaupadagskra.is", bareSiteHost);
        Assert.Equal("Hlaupadagskra.is", productIdHost);
    }

    [Fact]
    public void ComputeCalendarHosts_NoWwwPrefix_HostLeftUnchanged()
    {
        var (bareSiteHost, productIdHost) = CalendarHostHelpers.ComputeCalendarHosts("https://trails.is");

        Assert.Equal("trails.is", bareSiteHost);
        Assert.Equal("Trails.is", productIdHost);
    }

    [Fact]
    public void ComputeCalendarHosts_HostStartsWithDigit_CapitalizesFirstLetterNotFirstChar()
    {
        // char.ToUpperInvariant on index 0 alone would leave "360runs.com" untouched since '3' has
        // no upper-case form — CapitalizeFirstLetter instead walks to the first actual letter.
        var (bareSiteHost, productIdHost) = CalendarHostHelpers.ComputeCalendarHosts("https://360runs.com");

        Assert.Equal("360runs.com", bareSiteHost);
        Assert.Equal("360Runs.com", productIdHost);
    }

    [Fact]
    public void ComputeCalendarHosts_MalformedSiteUrl_FallsBackToProductionLiterals()
    {
        // A deliberate choice (#1048): degrade gracefully rather than throw, so a misconfigured
        // SiteUrl doesn't take down calendar.ics for an otherwise-empty date range — matching the
        // behaviour this endpoint had before #1045 moved the Uri parse ahead of the event loop.
        var (bareSiteHost, productIdHost) = CalendarHostHelpers.ComputeCalendarHosts("not a valid uri");

        Assert.Equal("hlaupadagskra.is", bareSiteHost);
        Assert.Equal("Hlaupadagskra.is", productIdHost);
    }

    [Fact]
    public void StripWwwPrefix_WwwPrefixIsCaseInsensitive()
    {
        Assert.Equal("hlaupadagskra.is", CalendarHostHelpers.StripWwwPrefix("WWW.hlaupadagskra.is"));
    }

    [Fact]
    public void CapitalizeFirstLetter_EmptyString_ReturnsEmptyString()
    {
        Assert.Equal("", CalendarHostHelpers.CapitalizeFirstLetter(""));
    }

    [Fact]
    public void CapitalizeFirstLetter_NoLetters_ReturnsUnchanged()
    {
        Assert.Equal("123.456", CalendarHostHelpers.CapitalizeFirstLetter("123.456"));
    }
}

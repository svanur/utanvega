using System.Linq;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level tests for <c>GET /api/v1/events/calendar.ics</c> (Program.cs,
/// <c>GetEventCalendarIcs</c>) — see #1035. The lang-branching (ProductId, Summary, Location,
/// Description) and the split cache key (<c>calendar_ics_content:{lang}</c>) both live directly in
/// the Program.cs handler rather than in a MediatR handler, so — following the pattern set by
/// <see cref="EventEndpointTests"/> — these go through <see cref="TestWebApplicationFactory"/>
/// against the real route instead of unit-testing a handler that never sees the query string.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class EventCalendarIcsEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private static DateOnly InRangeDate() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(10);

    private void SeedCalendarIntegrationFlag()
    {
        using var db = _factory.CreateDbContext();
        db.FeatureFlags.Add(new FeatureFlag { Name = "calendar_integration", Enabled = true });
        db.SaveChanges();
    }

    private (Event Event, EventEdition Edition) SeedFullyTranslatedEvent()
    {
        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Reykjavík",
            NameEn = "Reykjavik",
            Slug = "reykjavik",
        };
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Íslandshlaupið",
            NameEn = "The Iceland Run",
            Slug = "islandshlaupid",
            Type = EventType.Race,
            Status = EventStatus.Confirmed,
            OrganizerName = "Test Org",
            Location = location,
        };
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Date = InRangeDate(),
            Title = "Útgáfa 2026",
            TitleEn = "2026 Edition",
        };

        using var db = _factory.CreateDbContext();
        db.Locations.Add(location);
        db.Events.Add(ev);
        db.EventEditions.Add(edition);
        db.SaveChanges();

        return (ev, edition);
    }

    /// <summary>
    /// Same shape as <see cref="SeedFullyTranslatedEvent"/> but attaches a single active
    /// <see cref="Race"/> to the edition so <c>CalendarEventDto.RaceCount</c> (computed from
    /// <c>activeRaces.Count</c> in <c>GetEventCalendarQueryHandler</c>) is non-zero — exercising the
    /// "{RaceCount} race(s). More info: ..." branch of the Description text in
    /// <c>GetEventCalendarIcs</c> rather than the "RaceCount == 0" branch the other seed helpers hit.
    /// </summary>
    private (Event Event, EventEdition Edition) SeedFullyTranslatedEventWithRace()
    {
        var (ev, edition) = SeedFullyTranslatedEvent();

        using var db = _factory.CreateDbContext();
        db.Races.Add(new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "10K",
            Status = RaceStatus.Active,
        });
        db.SaveChanges();

        return (ev, edition);
    }

    private (Event Event, EventEdition Edition) SeedEventWithNoEnglishFields()
    {
        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Akureyri",
            Slug = "akureyri",
            // NameEn intentionally null
        };
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Norðurhlaupið",
            // NameEn intentionally null
            Slug = "nordurhlaupid",
            Type = EventType.Race,
            Status = EventStatus.Confirmed,
            OrganizerName = "Test Org",
            Location = location,
        };
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Date = InRangeDate(),
            Title = "Vetrarútgáfa",
            // TitleEn intentionally null
        };

        using var db = _factory.CreateDbContext();
        db.Locations.Add(location);
        db.Events.Add(ev);
        db.EventEditions.Add(edition);
        db.SaveChanges();

        return (ev, edition);
    }

    [Fact]
    public async Task NoFeatureFlag_ReturnsNotFound()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task NoLangParam_DefaultsToIcelandic_ContentAndPatchedProductId()
    {
        SeedCalendarIntegrationFlag();
        var (_, _) = SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics");
        response.EnsureSuccessStatusCode();
        var ics = await response.Content.ReadAsStringAsync();

        // #1051: the Icelandic/default path used to leave Ical.Net's library-default PRODID
        // untouched (see #1049/#1035) — it now gets the same post-serialization regex patch the
        // English feed already received, just with an "//IS" suffix instead of "//EN". Asserting
        // the exact expected line (not just "doesn't contain //Events//EN/IS") per #1051.
        var (_, productIdHost) = CalendarHostHelpers.ComputeCalendarHosts(CalendarHostHelpers.DefaultSiteUrl);
        Assert.Contains($"PRODID:-//{productIdHost}//Events//IS", ics);
        Assert.DoesNotContain("//Events//EN", ics);
        Assert.Contains("Íslandshlaupið", ics);
        Assert.Contains("Útgáfa 2026", ics);
        Assert.Contains("Reykjavík", ics);
    }

    [Fact]
    public async Task LangIs_ExplicitlyRequested_SameAsDefault()
    {
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var defaultResponse = await client.GetAsync("/api/v1/events/calendar.ics");
        var isResponse = await client.GetAsync("/api/v1/events/calendar.ics?lang=is");
        defaultResponse.EnsureSuccessStatusCode();
        isResponse.EnsureSuccessStatusCode();

        var defaultIcs = await defaultResponse.Content.ReadAsStringAsync();
        var isIcs = await isResponse.Content.ReadAsStringAsync();
        Assert.Equal(defaultIcs, isIcs);
    }

    [Fact]
    public async Task LangEn_ProductIdIsEN_AndUsesEnglishFieldsWhenPopulated()
    {
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics?lang=en");
        response.EnsureSuccessStatusCode();
        var ics = await response.Content.ReadAsStringAsync();

        Assert.Contains("//Events//EN", ics);
        Assert.Contains("The Iceland Run", ics);
        Assert.Contains("2026 Edition", ics);
        Assert.Contains("Reykjavik", ics);
        Assert.DoesNotContain("Íslandshlaupið", ics);
    }

    [Fact]
    public async Task LangEn_ProductIdUsesEnglishBrand_NotHlaupadagskra()
    {
        // #1161: the English feed's PRODID vendor token must read the 360runs.com brand
        // (DefaultSiteUrlEn), not the hlaupadagskra.is brand the Icelandic/default feed carries —
        // CalendarHostHelpers.CapitalizeFirstLetter already title-cases "360runs.com" to
        // "360Runs.com" (see CalendarHostHelpersTests), so this asserts the endpoint actually
        // threads SiteUrlEn into the English branch instead of reusing SiteUrl for both.
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics?lang=en");
        response.EnsureSuccessStatusCode();
        var ics = await response.Content.ReadAsStringAsync();

        var (_, productIdHost) = CalendarHostHelpers.ComputeCalendarHosts(CalendarHostHelpers.DefaultSiteUrlEn);
        Assert.Contains($"PRODID:-//{productIdHost}//Events//EN", ics);
        Assert.DoesNotContain("Hlaupadagskra.is", ics);
    }

    [Fact]
    public async Task LangEn_UidAndUrl_UseEnglishBrandDomain()
    {
        // #1161: each event's Uid suffix and Url should point at 360runs.com in the English feed,
        // not hlaupadagskra.is — mirroring the PRODID assertion above but for the per-event fields.
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics?lang=en");
        response.EnsureSuccessStatusCode();
        var ics = await response.Content.ReadAsStringAsync();

        var (bareSiteHost, _) = CalendarHostHelpers.ComputeCalendarHosts(CalendarHostHelpers.DefaultSiteUrlEn);
        Assert.Contains($"@{bareSiteHost}", ics);
        Assert.Contains($"URL:{CalendarHostHelpers.DefaultSiteUrlEn}/events/islandshlaupid", ics);
        Assert.DoesNotContain("hlaupadagskra.is", ics);
    }

    [Fact]
    public async Task LangEn_Description_UsesEnglishBrandDomain_NotHlaupadagskra()
    {
        // #1167: the "More info" links embedded in DESCRIPTION are deliberately fed from the same
        // siteUrl local as Uid/Url (Program.cs comment at GetEventCalendarIcs), so they should carry
        // the 360runs.com brand in the English feed too. Seeding a Race so RaceCount > 0 exercises
        // the "{RaceCount} race(s). More info: ..." branch specifically, not just the RaceCount == 0
        // fallback the other seed helpers hit.
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEventWithRace();

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics?lang=en");
        response.EnsureSuccessStatusCode();
        var ics = await response.Content.ReadAsStringAsync();

        var (bareSiteHost, _) = CalendarHostHelpers.ComputeCalendarHosts(CalendarHostHelpers.DefaultSiteUrlEn);

        // RFC 5545 line-folds any content line over 75 octets, continuing it on the next physical
        // line prefixed with a single space — DESCRIPTION (with two "More info" links embedded) is
        // long enough to fold, so unfold before locating the property's full value.
        var unfolded = ics.Replace("\r\n ", string.Empty).Replace("\r\n\t", string.Empty);
        var descriptionLine = unfolded
            .Split("\r\n", StringSplitOptions.None)
            .FirstOrDefault(l => l.StartsWith("DESCRIPTION:", StringComparison.Ordinal));

        Assert.NotNull(descriptionLine);
        Assert.Contains("1 race(s)", descriptionLine);
        Assert.Contains(bareSiteHost, descriptionLine);
        Assert.Contains(CalendarHostHelpers.DefaultSiteUrlEn, descriptionLine);
        Assert.DoesNotContain("hlaupadagskra.is", descriptionLine);

        // #1204: the English tagline was a stale leftover ("All trail races in one place") fixed
        // for frontend edge functions in #1198/PR #1203; this asserts the backend's calendar.ics
        // feed carries the same corrected wording.
        Assert.Contains("All running events in one place", descriptionLine);
    }

    [Fact]
    public async Task LangEn_FallsBackToIcelandicFields_WhenEnglishFieldsAreNull()
    {
        SeedCalendarIntegrationFlag();
        SeedEventWithNoEnglishFields();

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics?lang=en");
        response.EnsureSuccessStatusCode();
        var ics = await response.Content.ReadAsStringAsync();

        // Never empty: falls back to the Icelandic value for every field lacking an English one.
        Assert.Contains("Norðurhlaupið", ics);
        Assert.Contains("Vetrarútgáfa", ics);
        Assert.Contains("Akureyri", ics);
    }

    [Fact]
    public async Task LangEN_UppercaseVariant_MatchesLangEnExactly()
    {
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var lowerResponse = await client.GetAsync("/api/v1/events/calendar.ics?lang=en");
        var upperResponse = await client.GetAsync("/api/v1/events/calendar.ics?lang=EN");
        lowerResponse.EnsureSuccessStatusCode();
        upperResponse.EnsureSuccessStatusCode();

        var lowerIcs = await lowerResponse.Content.ReadAsStringAsync();
        var upperIcs = await upperResponse.Content.ReadAsStringAsync();

        // #1050: lang matching used to be an exact-case comparison, so ?lang=EN silently fell through
        // to the Icelandic feed. Case-insensitive matching means both requests land in the same
        // "en" cache bucket and produce byte-for-byte identical output.
        Assert.Equal(lowerIcs, upperIcs);
        Assert.Contains("//Events//EN", upperIcs);
        Assert.Contains("The Iceland Run", upperIcs);
    }

    [Fact]
    public async Task LangXyz_UnrecognizedValue_FallsBackToIcelandic()
    {
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var defaultResponse = await client.GetAsync("/api/v1/events/calendar.ics");
        var xyzResponse = await client.GetAsync("/api/v1/events/calendar.ics?lang=xyz");
        defaultResponse.EnsureSuccessStatusCode();
        xyzResponse.EnsureSuccessStatusCode();

        var defaultIcs = await defaultResponse.Content.ReadAsStringAsync();
        var xyzIcs = await xyzResponse.Content.ReadAsStringAsync();

        // Only "en" (case-insensitively) should ever select the English feed — any other value,
        // recognized or not, continues to resolve to the Icelandic/default feed unchanged.
        Assert.Equal(defaultIcs, xyzIcs);
        Assert.DoesNotContain("//Events//EN", xyzIcs);
        Assert.Contains("Íslandshlaupið", xyzIcs);
    }

    [Fact]
    public async Task BothLangs_CacheIndependently_NeitherStalesTheOther()
    {
        SeedCalendarIntegrationFlag();
        SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();

        // Populate the "is" cache entry first, then the "en" one, then re-request "is" — if both
        // shared one cache key, this last call would come back holding the English ProductId/content
        // instead of the Icelandic one it started with.
        var isFirst = await client.GetAsync("/api/v1/events/calendar.ics?lang=is");
        var en = await client.GetAsync("/api/v1/events/calendar.ics?lang=en");
        var isSecond = await client.GetAsync("/api/v1/events/calendar.ics?lang=is");

        var isFirstIcs = await isFirst.Content.ReadAsStringAsync();
        var enIcs = await en.Content.ReadAsStringAsync();
        var isSecondIcs = await isSecond.Content.ReadAsStringAsync();

        Assert.DoesNotContain("//Events//EN", isFirstIcs);
        Assert.Contains("//Events//EN", enIcs);
        Assert.DoesNotContain("//Events//EN", isSecondIcs);
        Assert.Equal(isFirstIcs, isSecondIcs);
        Assert.NotEqual(isSecondIcs, enIcs);
    }
}

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
    public async Task NoLangParam_DefaultsToIcelandic_ContentAndUnpatchedProductId()
    {
        SeedCalendarIntegrationFlag();
        var (_, _) = SeedFullyTranslatedEvent();

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events/calendar.ics");
        response.EnsureSuccessStatusCode();
        var ics = await response.Content.ReadAsStringAsync();

        // Ical.Net's serializer always writes its own library-default PRODID regardless of what's
        // assigned on the Calendar object (see the comment above the isEnglish patch in Program.cs)
        // — the Icelandic/default path deliberately leaves that untouched rather than patching it,
        // so "byte-for-byte unchanged from today" means the library's own PRODID line survives here,
        // not a "-//host//Events//IS" of our own (which has never once reached a served feed). Not
        // asserting the exact upstream string, since a future Ical.Net upgrade could change it —
        // only that neither of *our* language-tagged variants appears.
        Assert.DoesNotContain("//Events//EN", ics);
        Assert.DoesNotContain("//Events//IS", ics);
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

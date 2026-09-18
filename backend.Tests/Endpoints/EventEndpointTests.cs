using System.Net.Http.Json;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level tests for the public <c>GET /api/v1/events</c> route, exercising the real
/// minimal-API pipeline through <see cref="TestWebApplicationFactory"/> — see #591.
///
/// #907's fix gated <c>EventSummaryDto.AnyEditionNeedsReview</c> on <c>GetEventsQuery.IncludeHidden</c>
/// inside the handler, but the public endpoint (Program.cs, <c>GetPublicEvents</c>) originally bound
/// <c>includeHidden</c> straight from the query string with no auth check — any anonymous caller
/// could pass <c>?includeHidden=true</c> and get the admin aggregate (and admin-only Hidden events)
/// back. A handler-level test (see <c>EventHandlerTests</c>) can't prove that hole, because it never
/// goes through the endpoint's parameter binding at all — only an HTTP-level test against the real
/// route can. This was fixed by removing the <c>includeHidden</c> parameter from the public route's
/// signature entirely; the admin equivalent lives at the separately-authorized
/// <c>GET /api/v1/admin/events</c>.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class EventEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private Event CreateTestEvent(string name, EventStatus status = EventStatus.Confirmed)
    {
        return new Event
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Type = EventType.Race,
            Status = status,
            OrganizerName = "Test Org",
        };
    }

    private EventEdition CreateTestEdition(Guid eventId, bool needsReview = false)
    {
        return new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Year = 2026,
            Date = new DateOnly(2026, 7, 12),
            Title = "2026 Edition",
            RegistrationStatus = RegistrationStatus.Open,
            NeedsReview = needsReview,
        };
    }

    [Fact]
    public async Task GetPublicEvents_IgnoresClientSuppliedIncludeHidden_HiddenEventNeverReturned()
    {
        var hiddenEvent = CreateTestEvent("Hidden Only Event", EventStatus.Hidden);

        using (var db = _factory.CreateDbContext())
        {
            db.Events.Add(hiddenEvent);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events?includeHidden=true");
        response.EnsureSuccessStatusCode();

        var events = await response.Content.ReadFromJsonAsync<List<EventSummaryDto>>();
        Assert.NotNull(events);
        Assert.DoesNotContain(events!, e => e.Id == hiddenEvent.Id);
    }

    [Fact]
    public async Task GetPublicEvents_IgnoresClientSuppliedIncludeHidden_AnyEditionNeedsReviewAlwaysFalse()
    {
        var ev = CreateTestEvent("Flagged Public Event");
        var edition = CreateTestEdition(ev.Id, needsReview: true);

        using (var db = _factory.CreateDbContext())
        {
            db.Events.Add(ev);
            db.EventEditions.Add(edition);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/events?includeHidden=true");
        response.EnsureSuccessStatusCode();

        var events = await response.Content.ReadFromJsonAsync<List<EventSummaryDto>>();
        Assert.NotNull(events);
        var dto = Assert.Single(events!, e => e.Id == ev.Id);
        Assert.False(dto.AnyEditionNeedsReview);
    }
}

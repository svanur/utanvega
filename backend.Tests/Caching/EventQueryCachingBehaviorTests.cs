using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events.Queries.GetEvent;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Caching;

/// <summary>
/// #737: the admin (IncludeHidden: true) variants of GetEventQuery/GetEventsQuery must never be
/// cached, because CacheInvalidator only clears the in-process IMemoryCache of the instance that
/// handled the write — on a multi-machine Fly.io deployment, other instances would otherwise keep
/// serving an admin a stale event for up to an hour after they just edited it.
///
/// Each pair of tests below runs the query twice through the real CachingBehavior against a
/// shared IMemoryCache, with a DB write happening in between that deliberately bypasses
/// CacheInvalidator entirely — simulating a write landing on a different machine than the read.
/// The admin variant must reflect the write immediately; the public variant must not (unchanged
/// behavior — it still relies on CacheInvalidator, which is covered elsewhere).
/// </summary>
public class EventQueryCachingBehaviorTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly IScheduleRuleEngine _scheduleEngine = new ScheduleRuleEngine();
    private readonly IMemoryCache _cache;

    public EventQueryCachingBehaviorTests()
    {
        _factory = new TestDbContextFactory();
        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _cache.Dispose();
    }

    private static Event CreateTestEvent(string name = "Original Name", string slug = "test-event") => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        Slug = slug,
        Type = EventType.Race,
        Status = EventStatus.Confirmed,
        OrganizerName = "Test Org",
    };

    // Renames the event directly against the DB, bypassing CacheInvalidator entirely — this is
    // the multi-instance blind spot from #737: a write lands on one Fly.io machine, but the
    // reading machine's in-process cache never hears about it.
    private async Task RenameEventAsync(Guid eventId, string newName)
    {
        using var ctx = _factory.CreateContext();
        var ev = await ctx.Events.FindAsync(eventId);
        ev!.Name = newName;
        await ctx.SaveChangesAsync();
    }

    // ─── GetEventQuery ───

    [Fact]
    public async Task GetEventQuery_AdminVariant_NeverServesStaleData_AcrossUninvalidatedWrite()
    {
        var ev = CreateTestEvent();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        var behavior = new CachingBehavior<GetEventQuery, EventDetailDto?>(_cache);
        var handlerCalls = 0;

        async Task<EventDetailDto?> InvokeAsync(GetEventQuery query)
        {
            using var ctx = _factory.CreateContext();
            var handler = new GetEventQueryHandler(ctx, _scheduleEngine);
            return await behavior.Handle(query, ct =>
            {
                handlerCalls++;
                return handler.Handle(query, ct);
            }, CancellationToken.None);
        }

        var query = new GetEventQuery(ev.Slug, IncludeHidden: true);
        var first = await InvokeAsync(query);
        Assert.Equal("Original Name", first!.Name);

        // Simulates an admin edit landing on a different machine than the one about to re-read.
        await RenameEventAsync(ev.Id, "Renamed Name");

        var second = await InvokeAsync(query);
        Assert.Equal("Renamed Name", second!.Name);
        Assert.Equal(2, handlerCalls);
    }

    [Fact]
    public async Task GetEventQuery_PublicVariant_StillServedFromCache_WithinCacheWindow()
    {
        var ev = CreateTestEvent();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        var behavior = new CachingBehavior<GetEventQuery, EventDetailDto?>(_cache);
        var handlerCalls = 0;

        async Task<EventDetailDto?> InvokeAsync(GetEventQuery query)
        {
            using var ctx = _factory.CreateContext();
            var handler = new GetEventQueryHandler(ctx, _scheduleEngine);
            return await behavior.Handle(query, ct =>
            {
                handlerCalls++;
                return handler.Handle(query, ct);
            }, CancellationToken.None);
        }

        var query = new GetEventQuery(ev.Slug, IncludeHidden: false);
        var first = await InvokeAsync(query);
        Assert.Equal("Original Name", first!.Name);

        await RenameEventAsync(ev.Id, "Renamed Name");

        var second = await InvokeAsync(query);
        // Unchanged behavior: still the cached (now-stale) value within the hour-long window,
        // and the handler/DB must not have been hit a second time.
        Assert.Equal("Original Name", second!.Name);
        Assert.Equal(1, handlerCalls);
    }

    // ─── GetEventsQuery ───

    [Fact]
    public async Task GetEventsQuery_AdminVariant_NeverServesStaleData_AcrossUninvalidatedWrite()
    {
        var ev = CreateTestEvent();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        var behavior = new CachingBehavior<GetEventsQuery, List<EventSummaryDto>>(_cache);
        var handlerCalls = 0;

        async Task<List<EventSummaryDto>> InvokeAsync(GetEventsQuery query)
        {
            using var ctx = _factory.CreateContext();
            var handler = new GetEventsQueryHandler(ctx, _scheduleEngine);
            return await behavior.Handle(query, ct =>
            {
                handlerCalls++;
                return handler.Handle(query, ct);
            }, CancellationToken.None);
        }

        var query = new GetEventsQuery(IncludeHidden: true);
        var first = await InvokeAsync(query);
        Assert.Equal("Original Name", first.Single(e => e.Id == ev.Id).Name);

        await RenameEventAsync(ev.Id, "Renamed Name");

        var second = await InvokeAsync(query);
        Assert.Equal("Renamed Name", second.Single(e => e.Id == ev.Id).Name);
        Assert.Equal(2, handlerCalls);
    }

    [Fact]
    public async Task GetEventsQuery_PublicVariant_StillServedFromCache_WithinCacheWindow()
    {
        var ev = CreateTestEvent();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        var behavior = new CachingBehavior<GetEventsQuery, List<EventSummaryDto>>(_cache);
        var handlerCalls = 0;

        async Task<List<EventSummaryDto>> InvokeAsync(GetEventsQuery query)
        {
            using var ctx = _factory.CreateContext();
            var handler = new GetEventsQueryHandler(ctx, _scheduleEngine);
            return await behavior.Handle(query, ct =>
            {
                handlerCalls++;
                return handler.Handle(query, ct);
            }, CancellationToken.None);
        }

        var query = new GetEventsQuery(IncludeHidden: false);
        var first = await InvokeAsync(query);
        Assert.Equal("Original Name", first.Single(e => e.Id == ev.Id).Name);

        await RenameEventAsync(ev.Id, "Renamed Name");

        var second = await InvokeAsync(query);
        Assert.Equal("Original Name", second.Single(e => e.Id == ev.Id).Name);
        Assert.Equal(1, handlerCalls);
    }
}

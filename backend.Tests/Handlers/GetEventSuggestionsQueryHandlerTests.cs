using Utanvega.Backend.Application.Events.Queries.GetEventSuggestions;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class GetEventSuggestionsQueryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public GetEventSuggestionsQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private static Event CreateEvent(string name, string slug, EventStatus status = EventStatus.Confirmed)
    {
        return new Event
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            Type = EventType.Race,
            Status = status,
            OrganizerName = "Test Org",
        };
    }

    [Fact]
    public async Task ReturnsPrefixMatch_BeforeContainsMatch()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(CreateEvent("Tindahlaup 1", "tindahlaup-1"));
            ctx.Events.Add(CreateEvent("Big Tindahlaup", "big-tindahlaup"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEventSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal("tindahlaup-1", result[0].Slug); // prefix match ranked first
        Assert.Equal("big-tindahlaup", result[1].Slug); // contains match second
    }

    [Fact]
    public async Task ReturnsWordOverlapMatch_WhenHyphenWordsReordered()
    {
        // Neither a prefix nor a substring of "laugavegur-ultra", but shares both hyphen-words
        // with it — exercises tier 3 (word overlap) exactly as GetTrailSuggestionsQuery does.
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(CreateEvent("Laugavegur Ultra", "laugavegur-ultra"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEventSuggestionsQuery("ultra-laugavegur"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("laugavegur-ultra", result[0].Slug);
    }

    [Fact]
    public async Task ReturnsWordOverlapMatch_WhenOnlyOneOfSeveralWordsShared()
    {
        // "esjan-hlidarfjall" has two significant words; the only candidate in the database
        // shares just one of them ("esjan") and not the other. Under the old AND-chained
        // .Where() semantics this candidate would never surface — only under OR semantics
        // does it become a tier-3 match.
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(CreateEvent("Esjan Vestari", "esjan-vestari"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEventSuggestionsQuery("esjan-hlidarfjall"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("esjan-vestari", result[0].Slug);
    }

    [Fact]
    public async Task ReturnsNoSuggestions_WhenNoNearMiss()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(CreateEvent("Laugavegur Ultra", "laugavegur-ultra"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEventSuggestionsQuery("gjaldkerahlaup"), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task ExcludesHiddenAndUnlistedEvents()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(CreateEvent("Tindahlaup Confirmed", "tindahlaup-confirmed"));
            ctx.Events.Add(CreateEvent("Tindahlaup Hidden", "tindahlaup-hidden", EventStatus.Hidden));
            ctx.Events.Add(CreateEvent("Tindahlaup Unlisted", "tindahlaup-unlisted", EventStatus.Unlisted));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEventSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("tindahlaup-confirmed", result[0].Slug);
    }

    [Fact]
    public async Task CapsResultsAtTen()
    {
        using (var ctx = _factory.CreateContext())
        {
            for (var i = 0; i < 15; i++)
            {
                ctx.Events.Add(CreateEvent($"Tindahlaup {i}", $"tindahlaup-{i}"));
            }
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEventSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Equal(10, result.Count);
    }

    [Fact]
    public async Task IncludesLocationNameAndEditionCount()
    {
        var location = new Location
        {
            Id = Guid.NewGuid(),
            Name = "Þórsmörk",
            Slug = "thorsmork",
        };
        var ev = CreateEvent("Tindahlaup", "tindahlaup-1");
        ev.LocationId = location.Id;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(new EventEdition
            {
                Id = Guid.NewGuid(),
                EventId = ev.Id,
                Year = 2025,
                RegistrationStatus = RegistrationStatus.Open,
            });
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEventSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("Þórsmörk", result[0].LocationName);
        Assert.Equal(1, result[0].EditionCount);
    }
}

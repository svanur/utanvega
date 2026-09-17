using Utanvega.Backend.Application.Trails.Queries.GetTrailSuggestions;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class GetTrailSuggestionsQueryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public GetTrailSuggestionsQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private static Trail CreateTrail(string name, string slug, TrailStatus status = TrailStatus.Published)
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            Status = status,
            ActivityTypeId = ActivityType.TrailRunning,
            Type = TrailType.Loop,
            Length = 1000,
        };
    }

    [Fact]
    public async Task ReturnsPrefixMatch_BeforeContainsMatch()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Tindahlaup 1", "tindahlaup-1"));
            ctx.Trails.Add(CreateTrail("Big Tindahlaup", "big-tindahlaup"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetTrailSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetTrailSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal("tindahlaup-1", result[0].Slug); // prefix match ranked first
        Assert.Equal("big-tindahlaup", result[1].Slug); // contains match second
    }

    [Fact]
    public async Task ReturnsWordOverlapMatch_WhenHyphenWordsReordered()
    {
        // Neither a prefix nor a substring of "laugavegur-ultra", but shares both hyphen-words
        // with it — exercises tier 3 (word overlap).
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Laugavegur Ultra", "laugavegur-ultra"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetTrailSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetTrailSuggestionsQuery("ultra-laugavegur"), CancellationToken.None);

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
            ctx.Trails.Add(CreateTrail("Esjan Vestari", "esjan-vestari"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetTrailSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetTrailSuggestionsQuery("esjan-hlidarfjall"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("esjan-vestari", result[0].Slug);
    }

    [Fact]
    public async Task ReturnsNoSuggestions_WhenNoNearMiss()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Laugavegur Ultra", "laugavegur-ultra"));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetTrailSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetTrailSuggestionsQuery("gjaldkerahlaup"), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task ExcludesUnpublishedTrails()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Tindahlaup Published", "tindahlaup-published"));
            ctx.Trails.Add(CreateTrail("Tindahlaup Draft", "tindahlaup-draft", TrailStatus.Draft));
            ctx.Trails.Add(CreateTrail("Tindahlaup Archived", "tindahlaup-archived", TrailStatus.Archived));
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetTrailSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetTrailSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("tindahlaup-published", result[0].Slug);
    }

    [Fact]
    public async Task CapsResultsAtTen()
    {
        using (var ctx = _factory.CreateContext())
        {
            for (var i = 0; i < 15; i++)
            {
                ctx.Trails.Add(CreateTrail($"Tindahlaup {i}", $"tindahlaup-{i}"));
            }
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetTrailSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetTrailSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Equal(10, result.Count);
    }

    [Fact]
    public async Task IncludesLengthActivityTypeAndTrailType()
    {
        var trail = CreateTrail("Tindahlaup", "tindahlaup-1");
        trail.Length = 5000;
        trail.ActivityTypeId = ActivityType.Hiking;
        trail.Type = TrailType.PointToPoint;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetTrailSuggestionsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetTrailSuggestionsQuery("tindahlaup"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(5000, result[0].Length);
        Assert.Equal(ActivityType.Hiking.ToString(), result[0].ActivityType);
        Assert.Equal(TrailType.PointToPoint.ToString(), result[0].TrailType);
    }
}

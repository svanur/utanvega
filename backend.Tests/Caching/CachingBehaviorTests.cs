using MediatR;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;

namespace Utanvega.Backend.Tests.Caching;

/// <summary>
/// Exercises CachingBehavior in isolation via a minimal ICacheable request, independent of any
/// real query/handler pair. See EventQueryCachingBehaviorTests for the #737 end-to-end scenario
/// (GetEventQuery/GetEventsQuery admin variants riding this same skip-caching guard).
/// </summary>
public class CachingBehaviorTests : IDisposable
{
    private readonly IMemoryCache _cache;

    public CachingBehaviorTests()
    {
        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose() => _cache.Dispose();

    private record TestRequest(TimeSpan Duration) : IRequest<string>, ICacheable
    {
        public string CacheKey => "test:cachingbehavior:key";
        public TimeSpan CacheDuration => Duration;
    }

    [Fact]
    public async Task PositiveDuration_SecondCall_ServedFromCache_HandlerInvokedOnce()
    {
        var behavior = new CachingBehavior<TestRequest, string>(_cache);
        var callCount = 0;
        RequestHandlerDelegate<string> next = _ =>
        {
            callCount++;
            return Task.FromResult($"result-{callCount}");
        };

        var request = new TestRequest(TimeSpan.FromHours(1));
        var first = await behavior.Handle(request, next, CancellationToken.None);
        var second = await behavior.Handle(request, next, CancellationToken.None);

        Assert.Equal(1, callCount);
        Assert.Equal(first, second);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task NonPositiveDuration_SkipsCache_HandlerInvokedEveryTime(int seconds)
    {
        var behavior = new CachingBehavior<TestRequest, string>(_cache);
        var callCount = 0;
        RequestHandlerDelegate<string> next = _ =>
        {
            callCount++;
            return Task.FromResult($"result-{callCount}");
        };

        var request = new TestRequest(TimeSpan.FromSeconds(seconds));
        var first = await behavior.Handle(request, next, CancellationToken.None);
        var second = await behavior.Handle(request, next, CancellationToken.None);

        Assert.Equal(2, callCount);
        Assert.NotEqual(first, second);
        // Never written to the cache under this key either — not just "read past it".
        Assert.False(_cache.TryGetValue(request.CacheKey, out _));
    }
}

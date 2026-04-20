using MediatR;
using Microsoft.Extensions.Caching.Memory;

namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// MediatR pipeline behavior that caches responses for requests implementing ICacheable.
/// Uses a runtime check rather than a generic constraint to avoid DI resolution failures
/// for non-cacheable request types when registered as an open generic.
/// </summary>
public class CachingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IMemoryCache _cache;

    public CachingBehavior(IMemoryCache cache)
    {
        _cache = cache;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is not ICacheable cacheable)
            return await next(cancellationToken);

        var key = cacheable.CacheKey;

        if (_cache.TryGetValue(key, out TResponse? cached) && cached is not null)
            return cached;

        var result = await next(cancellationToken);

        if (result is not null)
            _cache.Set(key, result, cacheable.CacheDuration);

        return result;
    }
}

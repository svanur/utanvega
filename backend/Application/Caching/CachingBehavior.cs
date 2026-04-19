using MediatR;
using Microsoft.Extensions.Caching.Memory;

namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// MediatR pipeline behavior that caches responses for requests implementing ICacheable.
/// Sits alongside ValidationBehavior in the pipeline.
/// </summary>
public class CachingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ICacheable
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
        var key = request.CacheKey;

        if (_cache.TryGetValue(key, out TResponse? cached) && cached is not null)
            return cached;

        var result = await next(cancellationToken);

        if (result is not null)
            _cache.Set(key, result, request.CacheDuration);

        return result;
    }
}

namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// Marker interface for MediatR requests that should be cached.
/// Implement on query records to opt into automatic caching via CachingBehavior.
/// </summary>
public interface ICacheable
{
    string CacheKey { get; }
    TimeSpan CacheDuration { get; }
}

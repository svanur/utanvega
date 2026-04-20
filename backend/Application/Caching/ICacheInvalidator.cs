namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// Evicts cached query results when data is mutated.
/// Injected into command handlers to ensure cache consistency.
/// </summary>
public interface ICacheInvalidator
{
    void InvalidateTrail(string? slug = null);
    void InvalidateLocation(string? slug = null);
    void InvalidateCompetition(string? slug = null);
}

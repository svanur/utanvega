using Microsoft.Extensions.DependencyInjection;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Tests.WebHost;

/// <summary>
/// Covers <see cref="TestWebApplicationFactory.ValidateServiceProviderOrThrow"/> — the fail-fast
/// guard added in #678 for the reflection-based sweep in
/// <see cref="TestWebApplicationFactory.RemoveUtanvegaDbContextRegistrations"/> (called from
/// <see cref="TestWebApplicationFactory.ConfigureWebHost"/>).
///
/// Round 1 of this guard re-scanned <c>services</c> after removal using the exact same predicate
/// the removal loop had just used — which is tautological: whatever registration shape slips past
/// that predicate during removal slips past it identically the second time, so the guard could
/// never catch the actual failure mode #678 describes (a future EF Core internal service shaped
/// differently from what the predicate anticipates). <see cref="ValidateServiceProviderOrThrow"/>
/// fixes this by asking .NET's own DI container to resolve the whole graph instead of re-running
/// the same predicate — see <see cref="RemovalThenValidate_RegistrationNotClosedOverDbContextButDependsOnRemovedOne_StillThrows"/>,
/// which proves that specifically: it runs the *real* removal loop first, then shows the guard
/// still catches a leftover registration the removal predicate was blind to.
/// </summary>
public class TestWebApplicationFactoryGuardTests
{
    [Fact]
    public void ValidateServiceProviderOrThrow_ResolvableGraph_DoesNotThrow()
    {
        var services = new ServiceCollection();
        services.AddSingleton<string>("unrelated");

        var exception = Record.Exception(() =>
            TestWebApplicationFactory.ValidateServiceProviderOrThrow(services));

        Assert.Null(exception);
    }

    [Fact]
    public void ValidateServiceProviderOrThrow_UnresolvableDependency_Throws()
    {
        // ServiceWithMissingDependency needs IUnregisteredDependency, which nothing provides.
        var services = new ServiceCollection();
        services.AddSingleton<ServiceWithMissingDependency>();

        var exception = Assert.Throws<InvalidOperationException>(() =>
            TestWebApplicationFactory.ValidateServiceProviderOrThrow(services));

        Assert.Contains("TestWebApplicationFactory.cs", exception.Message);
        Assert.NotNull(exception.InnerException);
    }

    [Fact]
    public void RemovalThenValidate_RegistrationNotClosedOverDbContextButDependsOnRemovedOne_StillThrows()
    {
        var services = new ServiceCollection();

        // Registered under a ServiceType generic-closed-over-UtanvegaDbContext -- matches
        // RemoveUtanvegaDbContextRegistrations's predicate, standing in for the real
        // DbContextOptions<UtanvegaDbContext> registration AddDbContextPool produces.
        services.AddSingleton<IFakeDbContextOptions<UtanvegaDbContext>>(_ => null!);

        // Registered under a plain, non-generic ServiceType -- does NOT match that predicate, even
        // though it transitively depends on the registration above. Stands in for a hypothetical
        // future EF Core internal pooling service shaped so "closed over UtanvegaDbContext"
        // wouldn't catch it directly.
        services.AddSingleton<FutureEfInternalPoolingService>();

        TestWebApplicationFactory.RemoveUtanvegaDbContextRegistrations(services);

        // A tautological guard (re-scanning with the same removal predicate) would find zero
        // matches at this point -- FutureEfInternalPoolingService's own ServiceType was never
        // closed over UtanvegaDbContext, so removal never touched it and a second predicate-based
        // scan wouldn't either. ValidateServiceProviderOrThrow instead builds the real graph and
        // must still catch that FutureEfInternalPoolingService can no longer be constructed, since
        // its dependency was removed.
        var exception = Assert.Throws<InvalidOperationException>(() =>
            TestWebApplicationFactory.ValidateServiceProviderOrThrow(services));

        Assert.Contains("TestWebApplicationFactory.cs", exception.Message);
    }

    /// <summary>Stands in for the missing dependency in <see cref="ValidateServiceProviderOrThrow_UnresolvableDependency_Throws"/>.</summary>
    private interface IUnregisteredDependency;

    private class ServiceWithMissingDependency
    {
        public ServiceWithMissingDependency(IUnregisteredDependency dependency)
        {
        }
    }

    /// <summary>
    /// Stands in for EF Core's real <c>DbContextOptions&lt;UtanvegaDbContext&gt;</c> (and the other
    /// internal pooling types) in
    /// <see cref="RemovalThenValidate_RegistrationNotClosedOverDbContextButDependsOnRemovedOne_StillThrows"/>
    /// — a generic service type closed over <see cref="UtanvegaDbContext"/>, which is exactly what
    /// <c>RemoveUtanvegaDbContextRegistrations</c>'s predicate matches on.
    /// </summary>
    private interface IFakeDbContextOptions<T>;

    /// <summary>
    /// Stands in for a hypothetical future EF Core internal service whose own <c>ServiceType</c>
    /// isn't closed over <see cref="UtanvegaDbContext"/> — unlike <c>DbContextPool&lt;T&gt;</c>,
    /// <c>IDbContextPool&lt;T&gt;</c> and <c>IScopedDbContextLease&lt;T&gt;</c>, all of which are
    /// generic today. Its dependency on <see cref="IFakeDbContextOptions{T}"/> means removing that
    /// still leaves this unresolvable, even though this type itself never matched the removal
    /// predicate.
    /// </summary>
    private class FutureEfInternalPoolingService
    {
        public FutureEfInternalPoolingService(IFakeDbContextOptions<UtanvegaDbContext> options)
        {
        }
    }
}

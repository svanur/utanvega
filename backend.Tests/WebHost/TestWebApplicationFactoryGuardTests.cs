using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Tests.WebHost;

/// <summary>
/// Covers <see cref="TestWebApplicationFactory.ThrowIfUtanvegaDbContextStillRegistered"/> — the
/// fail-fast guard added in #678 for the reflection-based sweep in
/// <see cref="TestWebApplicationFactory.ConfigureWebHost"/>. Exercises the throw path directly
/// against a minimal <see cref="ServiceCollection"/> rather than through the full
/// <see cref="TestWebApplicationFactory"/> host-build path, which would require provoking an
/// actual EF Core / Microsoft.AspNetCore.Mvc.Testing version regression to reach the same code.
/// </summary>
public class TestWebApplicationFactoryGuardTests
{
    [Fact]
    public void ThrowIfUtanvegaDbContextStillRegistered_NoMatchingRegistration_DoesNotThrow()
    {
        var services = new ServiceCollection();
        services.AddSingleton<string>("unrelated");

        var exception = Record.Exception(() =>
            TestWebApplicationFactory.ThrowIfUtanvegaDbContextStillRegistered(services));

        Assert.Null(exception);
    }

    [Fact]
    public void ThrowIfUtanvegaDbContextStillRegistered_DirectRegistration_Throws()
    {
        var services = new ServiceCollection();
        services.AddSingleton<UtanvegaDbContext>(_ => null!);

        var exception = Assert.Throws<InvalidOperationException>(() =>
            TestWebApplicationFactory.ThrowIfUtanvegaDbContextStillRegistered(services));

        Assert.Contains("TestWebApplicationFactory.cs", exception.Message);
    }

    [Fact]
    public void ThrowIfUtanvegaDbContextStillRegistered_GenericRegistrationClosedOverDbContext_Throws()
    {
        // EF Core's real internal pooling services (IDbContextPool<T>, IScopedDbContextLease<T>)
        // aren't accessible from this assembly — that's the whole reason the sweep matches on
        // "closed over UtanvegaDbContext" rather than by type name. IFakeInternalPoolingService<T>
        // stands in for one: a generic service type closed over UtanvegaDbContext, matched via
        // GetGenericArguments() rather than the direct ServiceType == typeof(UtanvegaDbContext) check.
        var services = new ServiceCollection();
        services.AddSingleton<IFakeInternalPoolingService<UtanvegaDbContext>>(_ => null!);

        var exception = Assert.Throws<InvalidOperationException>(() =>
            TestWebApplicationFactory.ThrowIfUtanvegaDbContextStillRegistered(services));

        Assert.Contains("TestWebApplicationFactory.cs", exception.Message);
        Assert.Contains("IFakeInternalPoolingService", exception.Message);
    }

    /// <summary>
    /// Stands in for an EF Core internal pooling service (e.g. <c>IDbContextPool&lt;T&gt;</c>) in
    /// <see cref="ThrowIfUtanvegaDbContextStillRegistered_GenericRegistrationClosedOverDbContext_Throws"/> —
    /// those real types are internal to EF Core's own assembly and can't be referenced here.
    /// </summary>
    private interface IFakeInternalPoolingService<T>;
}

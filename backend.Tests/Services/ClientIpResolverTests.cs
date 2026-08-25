using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Utanvega.Backend.Infrastructure.Http;
using Xunit;

namespace Utanvega.Backend.Tests.Services;

public class ClientIpResolverTests
{
    private const bool OnFly = true;
    private const string Salt = "test-salt";
    private const bool OffFly = false;

    private static HttpContext Context(
        string? flyClientIp = null,
        string? remoteIp = null,
        string? forwardedFor = null,
        string[]? flyClientIpValues = null)
    {
        var context = new DefaultHttpContext();
        if (flyClientIp is not null) context.Request.Headers["Fly-Client-IP"] = flyClientIp;
        if (flyClientIpValues is not null) context.Request.Headers["Fly-Client-IP"] = new StringValues(flyClientIpValues);
        if (forwardedFor is not null) context.Request.Headers["X-Forwarded-For"] = forwardedFor;
        if (remoteIp is not null) context.Connection.RemoteIpAddress = IPAddress.Parse(remoteIp);
        return context;
    }

    // ── On Fly: the header is set by the proxy and can be trusted ──────────

    [Fact]
    public void GetClientIp_PrefersFlyClientIp_OverProxyConnectionAddress()
    {
        // The whole point: behind Fly, RemoteIpAddress is the proxy.
        var ip = ClientIpResolver.GetClientIp(Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1"), OnFly);
        Assert.Equal("203.0.113.7", ip);
    }

    [Fact]
    public void GetClientIp_TakesLastHeaderValue_SoAnAppendedProxyValueWins()
    {
        // Fly replaces a client-supplied value, so there is normally one entry.
        // Should it ever append instead, the client's forged value would be
        // first and the proxy's real one last.
        var ip = ClientIpResolver.GetClientIp(
            Context(flyClientIpValues: ["1.2.3.4", "203.0.113.7"], remoteIp: "172.19.0.1"), OnFly);
        Assert.Equal("203.0.113.7", ip);
    }

    // ── Off Fly: the header is just client input and must be ignored ───────

    [Fact]
    public void GetClientIp_IgnoresFlyHeader_WhenNotRunningOnFly()
    {
        // Reached directly, Fly-Client-IP is attacker-controlled. Honouring it
        // would let anyone defeat the rate limits by rotating fake addresses.
        var ip = ClientIpResolver.GetClientIp(Context(flyClientIp: "1.2.3.4", remoteIp: "192.168.1.50"), OffFly);
        Assert.Equal("192.168.1.50", ip);
    }

    [Fact]
    public void GetPartitionKey_IgnoresForgedFlyHeader_WhenNotRunningOnFly()
    {
        // Two requests forging different IPs must land in the same partition,
        // or rate limiting can be bypassed by cycling values.
        var a = ClientIpResolver.GetPartitionKey(Context(flyClientIp: "1.1.1.1", remoteIp: "192.168.1.50"), OffFly);
        var b = ClientIpResolver.GetPartitionKey(Context(flyClientIp: "2.2.2.2", remoteIp: "192.168.1.50"), OffFly);
        Assert.Equal(a, b);
        Assert.Equal("192.168.1.50", a);
    }

    [Fact]
    public void GetClientIp_FallsBackToConnectionAddress_WhenNoFlyHeader()
    {
        var ip = ClientIpResolver.GetClientIp(Context(remoteIp: "192.168.1.50"), OnFly);
        Assert.Equal("192.168.1.50", ip);
    }

    // ── X-Forwarded-For is never read ─────────────────────────────────────

    [Fact]
    public void GetClientIp_IgnoresXForwardedFor()
    {
        var ip = ClientIpResolver.GetClientIp(Context(remoteIp: "192.168.1.50", forwardedFor: "1.2.3.4"), OnFly);
        Assert.Equal("192.168.1.50", ip);
    }

    [Fact]
    public void GetClientIp_IgnoresXForwardedFor_EvenWhenFlyHeaderPresent()
    {
        var ip = ClientIpResolver.GetClientIp(
            Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1", forwardedFor: "1.2.3.4"), OnFly);
        Assert.Equal("203.0.113.7", ip);
    }

    // ── Blank and missing values ──────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void GetClientIp_IgnoresBlankFlyHeader(string blank)
    {
        var ip = ClientIpResolver.GetClientIp(Context(flyClientIp: blank, remoteIp: "192.168.1.50"), OnFly);
        Assert.Equal("192.168.1.50", ip);
    }

    [Fact]
    public void GetClientIp_TrimsWhitespace()
    {
        Assert.Equal("203.0.113.7", ClientIpResolver.GetClientIp(Context(flyClientIp: "  203.0.113.7  "), OnFly));
    }

    [Fact]
    public void GetClientIp_ReturnsEmpty_WhenNothingAvailable()
    {
        Assert.Equal(string.Empty, ClientIpResolver.GetClientIp(Context(), OnFly));
    }

    // ── Partition keys ────────────────────────────────────────────────────

    [Fact]
    public void GetPartitionKey_SeparatesDistinctClients()
    {
        // Regression guard for the bug this replaced: every visitor shared one
        // partition, so the limits applied globally rather than per visitor.
        var a = ClientIpResolver.GetPartitionKey(Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1"), OnFly);
        var b = ClientIpResolver.GetPartitionKey(Context(flyClientIp: "203.0.113.8", remoteIp: "172.19.0.1"), OnFly);
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void GetPartitionKey_FallsBackToUnknown_WhenIpUnavailable()
    {
        Assert.Equal(ClientIpResolver.Unknown, ClientIpResolver.GetPartitionKey(Context(), OnFly));
    }

    // ── Hashing ───────────────────────────────────────────────────────────

    [Fact]
    public void GetClientIpHash_ReturnsNull_WhenIpUnknown()
    {
        // Not SHA-256(""): a present hash means "one identified visitor", so a
        // constant hash would put every unidentifiable request in one bucket
        // and RecordTrailView would discard all but the first view per window.
        Assert.Null(ClientIpResolver.GetClientIpHash(Context(), Salt, OnFly));
    }

    [Fact]
    public void GetClientIpHash_IsStableForSameClient()
    {
        var a = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7"), Salt, OnFly);
        var b = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7"), Salt, OnFly);
        Assert.Equal(a, b);
    }

    [Fact]
    public void GetClientIpHash_DiffersBetweenClients()
    {
        var a = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1"), Salt, OnFly);
        var b = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.8", remoteIp: "172.19.0.1"), Salt, OnFly);
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void GetClientIpHash_IsLowercaseHexSha256()
    {
        var hash = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7"), Salt, OnFly);
        Assert.NotNull(hash);
        Assert.Equal(64, hash!.Length);
        Assert.Matches("^[0-9a-f]{64}$", hash);
    }

    // ── Salting ───────────────────────────────────────────────────────────

    [Fact]
    public void HashIp_DiffersBySalt()
    {
        // Without a salt an IPv4 digest can be reversed by hashing the whole
        // address space, so the salt is what makes the stored value opaque.
        Assert.NotEqual(
            ClientIpResolver.HashIp("203.0.113.7", "salt-one"),
            ClientIpResolver.HashIp("203.0.113.7", "salt-two"));
    }

    [Fact]
    public void HashIp_IsStableForTheSameSaltAndAddress()
    {
        // Deduplication and unique-visitor counting both depend on a returning
        // visitor hashing to the same value.
        Assert.Equal(
            ClientIpResolver.HashIp("203.0.113.7", Salt),
            ClientIpResolver.HashIp("203.0.113.7", Salt));
    }

    [Fact]
    public void HashIp_SeparatesAddressesUnderOneSalt()
    {
        Assert.NotEqual(
            ClientIpResolver.HashIp("203.0.113.7", Salt),
            ClientIpResolver.HashIp("203.0.113.8", Salt));
    }

    [Fact]
    public void HashIp_DoesNotCollideAcrossTheSaltBoundary()
    {
        // Guards against naive concatenation letting ("ab","c") and ("a","bc")
        // land on the same digest.
        Assert.NotEqual(
            ClientIpResolver.HashIp("3.7", "203.0.11"),
            ClientIpResolver.HashIp("03.7", "203.0.1"));
    }
}

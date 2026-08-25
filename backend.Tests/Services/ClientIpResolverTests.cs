using System.Net;
using Microsoft.AspNetCore.Http;
using Utanvega.Backend.Infrastructure.Http;
using Xunit;

namespace Utanvega.Backend.Tests.Services;

public class ClientIpResolverTests
{
    private static HttpContext Context(string? flyClientIp = null, string? remoteIp = null, string? forwardedFor = null)
    {
        var context = new DefaultHttpContext();
        if (flyClientIp is not null) context.Request.Headers["Fly-Client-IP"] = flyClientIp;
        if (forwardedFor is not null) context.Request.Headers["X-Forwarded-For"] = forwardedFor;
        if (remoteIp is not null) context.Connection.RemoteIpAddress = IPAddress.Parse(remoteIp);
        return context;
    }

    [Fact]
    public void GetClientIp_PrefersFlyClientIp_OverProxyConnectionAddress()
    {
        // The whole point: behind Fly, RemoteIpAddress is the proxy.
        var ip = ClientIpResolver.GetClientIp(Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1"));
        Assert.Equal("203.0.113.7", ip);
    }

    [Fact]
    public void GetClientIp_FallsBackToConnectionAddress_WhenNotBehindFly()
    {
        var ip = ClientIpResolver.GetClientIp(Context(remoteIp: "192.168.1.50"));
        Assert.Equal("192.168.1.50", ip);
    }

    [Fact]
    public void GetClientIp_IgnoresXForwardedFor()
    {
        // X-Forwarded-For is client-supplied. Trusting it would let anyone
        // evade a rate limit by rotating a fabricated address.
        var ip = ClientIpResolver.GetClientIp(Context(remoteIp: "192.168.1.50", forwardedFor: "1.2.3.4"));
        Assert.Equal("192.168.1.50", ip);
    }

    [Fact]
    public void GetClientIp_IgnoresXForwardedFor_EvenWhenFlyHeaderPresent()
    {
        var ip = ClientIpResolver.GetClientIp(
            Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1", forwardedFor: "1.2.3.4"));
        Assert.Equal("203.0.113.7", ip);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void GetClientIp_IgnoresBlankFlyHeader(string blank)
    {
        var ip = ClientIpResolver.GetClientIp(Context(flyClientIp: blank, remoteIp: "192.168.1.50"));
        Assert.Equal("192.168.1.50", ip);
    }

    [Fact]
    public void GetClientIp_TrimsWhitespace()
    {
        var ip = ClientIpResolver.GetClientIp(Context(flyClientIp: "  203.0.113.7  "));
        Assert.Equal("203.0.113.7", ip);
    }

    [Fact]
    public void GetClientIp_ReturnsEmpty_WhenNothingAvailable()
    {
        Assert.Equal(string.Empty, ClientIpResolver.GetClientIp(Context()));
    }

    [Fact]
    public void GetPartitionKey_SeparatesDistinctClients()
    {
        // Regression guard for the bug this replaced: every visitor shared one
        // partition, so the limits applied globally rather than per visitor.
        var a = ClientIpResolver.GetPartitionKey(Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1"));
        var b = ClientIpResolver.GetPartitionKey(Context(flyClientIp: "203.0.113.8", remoteIp: "172.19.0.1"));
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void GetPartitionKey_FallsBackToUnknown_WhenIpUnavailable()
    {
        Assert.Equal(ClientIpResolver.Unknown, ClientIpResolver.GetPartitionKey(Context()));
    }

    [Fact]
    public void GetClientIpHash_IsStableForSameClient()
    {
        var a = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7"));
        var b = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7"));
        Assert.Equal(a, b);
    }

    [Fact]
    public void GetClientIpHash_DiffersBetweenClients()
    {
        var a = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7", remoteIp: "172.19.0.1"));
        var b = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.8", remoteIp: "172.19.0.1"));
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void GetClientIpHash_IsLowercaseHexSha256()
    {
        var hash = ClientIpResolver.GetClientIpHash(Context(flyClientIp: "203.0.113.7"));
        Assert.Equal(64, hash.Length);
        Assert.Matches("^[0-9a-f]{64}$", hash);
    }
}

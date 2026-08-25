using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace Utanvega.Backend.Infrastructure.Http;

/// <summary>
/// Resolves the real client IP behind Fly.io's proxy.
///
/// <para>
/// <see cref="ConnectionInfo.RemoteIpAddress"/> is the proxy's address, not the
/// visitor's — responses carry <c>via: 1.1 fly.io, 1.1 fly.io</c>, so every
/// visitor collapses onto a handful of internal addresses. Using it directly
/// made rate limiting global rather than per-visitor, and made analytics count
/// proxies instead of people.
/// </para>
///
/// <para>
/// Fly sets <c>Fly-Client-IP</c> at the edge and overwrites any value the
/// client supplies, so it cannot be forged. <c>X-Forwarded-For</c> is
/// deliberately NOT read: it arrives client-controlled, and trusting it would
/// let anyone evade a rate limit by rotating a fabricated address. That is also
/// why this is a small explicit helper rather than
/// <c>UseForwardedHeaders</c> — that middleware is only safe once
/// <c>KnownProxies</c>/<c>KnownNetworks</c> are pinned to Fly's private
/// network, and getting that wrong fails open.
/// </para>
/// </summary>
public static class ClientIpResolver
{
    private const string FlyClientIpHeader = "Fly-Client-IP";

    /// <summary>Partition key used when the client IP cannot be determined.</summary>
    public const string Unknown = "unknown";

    /// <summary>
    /// The client's IP, or an empty string when it cannot be determined.
    /// Falls back to the connection address, which is correct off Fly (local
    /// development) and no worse than the previous behaviour anywhere else.
    /// </summary>
    public static string GetClientIp(HttpContext context)
    {
        var flyClientIp = context.Request.Headers[FlyClientIpHeader].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(flyClientIp))
        {
            return flyClientIp.Trim();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
    }

    /// <summary>Client IP for use as a rate-limit partition key.</summary>
    public static string GetPartitionKey(HttpContext context)
    {
        var ip = GetClientIp(context);
        return string.IsNullOrEmpty(ip) ? Unknown : ip;
    }

    /// <summary>
    /// SHA-256 of the client IP, lowercase hex, for storing alongside a view
    /// without retaining the address itself.
    /// </summary>
    public static string GetClientIpHash(HttpContext context)
    {
        var ip = GetClientIp(context);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ip))).ToLowerInvariant();
    }
}

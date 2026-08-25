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
/// <c>Fly-Client-IP</c> is only trusted when the process is actually running on
/// Fly, detected via the <c>FLY_APP_NAME</c> environment variable Fly injects.
/// The header is trustworthy only because Fly's proxy overwrites whatever the
/// client sent; reached any other way it is just client-controlled input, and
/// honouring it would let anyone defeat the rate limits this class exists to
/// make work by rotating fabricated addresses.
/// </para>
///
/// <para>
/// <c>X-Forwarded-For</c> is deliberately never read: it arrives
/// client-controlled with no equivalent guarantee. That is also why this is a
/// small explicit helper rather than <c>UseForwardedHeaders</c> — that
/// middleware is only safe once <c>KnownProxies</c>/<c>KnownNetworks</c> are
/// pinned to Fly's private network, and it fails open when they are not.
/// </para>
/// </summary>
public static class ClientIpResolver
{
    private const string FlyClientIpHeader = "Fly-Client-IP";

    /// <summary>Partition key used when the client IP cannot be determined.</summary>
    public const string Unknown = "unknown";

    /// <summary>
    /// True when running on Fly, where <c>Fly-Client-IP</c> is set by the proxy
    /// and cannot be forged. Fly injects <c>FLY_APP_NAME</c> into every machine.
    /// </summary>
    private static readonly bool RunningOnFly =
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("FLY_APP_NAME"));

    /// <summary>
    /// The client's IP, or an empty string when it cannot be determined.
    /// </summary>
    public static string GetClientIp(HttpContext context) => GetClientIp(context, RunningOnFly);

    /// <summary>
    /// Explicit form, for tests and for callers that know whether the request
    /// arrived through a proxy whose header can be trusted.
    /// </summary>
    /// <param name="trustFlyHeader">
    /// Whether <c>Fly-Client-IP</c> came from Fly's proxy. When false the header
    /// is ignored entirely and only the connection address is used.
    /// </param>
    public static string GetClientIp(HttpContext context, bool trustFlyHeader)
    {
        if (trustFlyHeader)
        {
            // LastOrDefault, not FirstOrDefault: Fly replaces any client-supplied
            // value, so there is normally one entry. Should it ever append
            // instead, the proxy's value is the last and the client's is the
            // first — taking the last is correct under both behaviours.
            var flyClientIp = context.Request.Headers[FlyClientIpHeader].LastOrDefault();
            if (!string.IsNullOrWhiteSpace(flyClientIp))
            {
                return flyClientIp.Trim();
            }
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
    }

    /// <summary>Client IP for use as a rate-limit partition key.</summary>
    public static string GetPartitionKey(HttpContext context) => GetPartitionKey(context, RunningOnFly);

    /// <inheritdoc cref="GetPartitionKey(HttpContext)"/>
    public static string GetPartitionKey(HttpContext context, bool trustFlyHeader)
    {
        var ip = GetClientIp(context, trustFlyHeader);
        return string.IsNullOrEmpty(ip) ? Unknown : ip;
    }

    /// <summary>
    /// SHA-256 of the client IP as lowercase hex, or <c>null</c> when the IP is
    /// unknown.
    ///
    /// <para>
    /// Null rather than the hash of an empty string: callers treat a present
    /// hash as identifying one visitor, so hashing <c>""</c> would put every
    /// unidentifiable request into a single shared bucket. That would make
    /// <c>RecordTrailView</c>'s deduplication discard all but the first such
    /// view of each trail per window.
    /// </para>
    /// </summary>
    public static string? GetClientIpHash(HttpContext context) => GetClientIpHash(context, RunningOnFly);

    /// <inheritdoc cref="GetClientIpHash(HttpContext)"/>
    public static string? GetClientIpHash(HttpContext context, bool trustFlyHeader)
    {
        var ip = GetClientIp(context, trustFlyHeader);
        if (string.IsNullOrEmpty(ip))
        {
            return null;
        }

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ip))).ToLowerInvariant();
    }
}

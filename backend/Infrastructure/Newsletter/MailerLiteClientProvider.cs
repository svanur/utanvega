using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Utanvega.Backend.Infrastructure.Newsletter;

/// <summary>Outcome of a <see cref="MailerLiteClientProvider.SubscribeAsync"/> call.</summary>
public enum MailerLiteSubscribeOutcome
{
    /// <summary>MailerLite accepted the email as a new or updated subscriber.</summary>
    Subscribed,

    /// <summary>
    /// MailerLite reports the email is already a member of the configured group. Treated as a
    /// success case by callers — see #1641.
    /// </summary>
    AlreadySubscribed,

    /// <summary>Anything else: missing config, a non-success response, or a network failure.</summary>
    Failed,
}

/// <summary>
/// Result of a subscribe attempt. <see cref="ErrorDetail"/> is for server-side logging only — it
/// may carry MailerLite's raw response body or an exception message, neither of which is safe to
/// return to the caller.
/// </summary>
public sealed record MailerLiteSubscribeResult(MailerLiteSubscribeOutcome Outcome, string? ErrorDetail = null);

/// <summary>
/// Lazily creates and reuses a single MailerLite-configured <see cref="HttpClient"/> for the
/// lifetime of the app, mirroring <c>DeepLTranslatorProvider</c>'s shape (see that class's doc
/// comment) — instead of building one per request, and instead of resolving the API key before it
/// is known to be configured at all.
///
/// <para>
/// Talks to MailerLite's subscribers API (https://developers.mailerlite.com) to add an email to the
/// group configured via <c>MailerLite:GroupId</c>. Both <c>MailerLite:ApiKey</c> and
/// <c>MailerLite:GroupId</c> are read from <see cref="IConfiguration"/> only — local via
/// <c>dotnet user-secrets</c>, production via the Fly.io secrets
/// <c>MailerLite__ApiKey</c>/<c>MailerLite__GroupId</c>. Neither value is ever exposed beyond this
/// class.
/// </para>
/// </summary>
public sealed class MailerLiteClientProvider
{
    private const string SubscribersPath = "api/subscribers";

    private readonly Lazy<HttpClient?> _client;
    private readonly string? _groupId;

    public MailerLiteClientProvider(IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        var apiKey = config["MailerLite:ApiKey"];
        _groupId = config["MailerLite:GroupId"];

        _client = new Lazy<HttpClient?>(() =>
        {
            if (string.IsNullOrWhiteSpace(apiKey))
                return null;

            var client = httpClientFactory.CreateClient("MailerLite");
            client.BaseAddress = new Uri("https://connect.mailerlite.com/");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            return client;
        });
    }

    /// <summary>True once an API key is configured — false means the client was never built.</summary>
    public bool IsConfigured => _client.Value is not null;

    /// <summary>
    /// Adds <paramref name="email"/> to the configured group. MailerLite's subscribers endpoint
    /// upserts by email, so re-subscribing an existing address is itself idempotent and comes back
    /// as a normal success — <see cref="MailerLiteSubscribeOutcome.AlreadySubscribed"/> additionally
    /// covers the documented case where MailerLite instead responds with a 422 specifically because
    /// the address already belongs to the group, so that path is a success too, not an error.
    ///
    /// <para>
    /// A network-level failure (DNS, timeout, connection reset) throws rather than returning
    /// <see cref="MailerLiteSubscribeOutcome.Failed"/> — callers are expected to catch it the same
    /// way <c>SubmitFeedback</c> catches any other outbound-call exception, so the raw exception
    /// reaches <c>logger.LogError</c> with its original type and stack trace intact.
    /// </para>
    /// </summary>
    public async Task<MailerLiteSubscribeResult> SubscribeAsync(string email, CancellationToken ct = default)
    {
        var client = _client.Value;
        if (client is null)
            return new MailerLiteSubscribeResult(MailerLiteSubscribeOutcome.Failed, "MailerLite API key is not configured.");

        var payload = new
        {
            email,
            groups = string.IsNullOrWhiteSpace(_groupId) ? Array.Empty<string>() : new[] { _groupId },
        };

        using var response = await client.PostAsJsonAsync(SubscribersPath, payload, ct);

        if (response.IsSuccessStatusCode)
            return new MailerLiteSubscribeResult(MailerLiteSubscribeOutcome.Subscribed);

        var body = await response.Content.ReadAsStringAsync(ct);

        if (LooksAlreadySubscribed(response.StatusCode, body))
            return new MailerLiteSubscribeResult(MailerLiteSubscribeOutcome.AlreadySubscribed);

        return new MailerLiteSubscribeResult(
            MailerLiteSubscribeOutcome.Failed,
            $"MailerLite returned {(int)response.StatusCode}: {RedactEmail(body, email)}");
    }

    /// <summary>
    /// Replaces any case-insensitive occurrence of <paramref name="email"/> within
    /// <paramref name="body"/> with a placeholder — MailerLite's error bodies commonly echo the
    /// submitted address back in their diagnostic text, and <see cref="ErrorDetail"/> above ends
    /// up in server logs verbatim, so the address must not survive into them (see #1647). A
    /// targeted substring replace, not a blanket suppression: bodies that don't contain the email
    /// pass through unchanged.
    /// </summary>
    private static string RedactEmail(string body, string email) =>
        string.IsNullOrEmpty(email)
            ? body
            : body.Replace(email, "[redacted]", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// MailerLite responds 422 with an error naming the email as already taken/in use when the
    /// address is already subscribed — a success outcome for a newsletter signup, not a failure.
    ///
    /// <para>
    /// This is a deliberate, acknowledged fallback: MailerLite's error response is not confirmed
    /// (from this codebase's sources — no access to their live API or current docs) to carry a
    /// structured error code distinguishing "already subscribed" from any other 422, so matching on
    /// the word "already" in the raw error text is what we have. Do not replace this with a
    /// structured-code check unless that code's shape has actually been verified against a real
    /// MailerLite response — see #1644.
    /// </para>
    /// </summary>
    private static bool LooksAlreadySubscribed(HttpStatusCode statusCode, string body) =>
        statusCode == HttpStatusCode.UnprocessableEntity &&
        body.Contains("already", StringComparison.OrdinalIgnoreCase);
}

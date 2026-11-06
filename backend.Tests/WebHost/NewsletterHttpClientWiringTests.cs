using Microsoft.Extensions.DependencyInjection;

namespace Utanvega.Backend.Tests.WebHost;

/// <summary>
/// Covers the "MailerLite" named <see cref="HttpClient"/> registration in
/// <c>Program.cs</c> (<c>builder.Services.AddHttpClient("MailerLite")...ConfigureHttpClient(...)</c>,
/// see the #1659 comment at that call site) — specifically, that its <see cref="HttpClient.Timeout"/>
/// stays at 20 seconds, comfortably under the newsletter subscribe endpoint's 30-second in-flight
/// cooldown marker TTL (see <c>NewsletterCooldownGate</c>). Unlike
/// <see cref="Utanvega.Backend.Tests.Endpoints.NewsletterEndpointTests"/>, which always swaps in a
/// hand-built <see cref="HttpClient"/> via a mocked <see cref="IHttpClientFactory"/> to control the
/// response body, this resolves the real client through an unmodified
/// <see cref="TestWebApplicationFactory"/> (no <c>WithWebHostBuilder</c> override) — the one path
/// that actually exercises Program.cs's own registration rather than a stand-in for it.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class NewsletterHttpClientWiringTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public void MailerLiteHttpClient_ResolvedFromRealProgramCsRegistration_HasTwentySecondTimeout()
    {
        var httpClientFactory = _factory.Services.GetRequiredService<IHttpClientFactory>();

        var client = httpClientFactory.CreateClient("MailerLite");

        Assert.Equal(TimeSpan.FromSeconds(20), client.Timeout);
    }
}

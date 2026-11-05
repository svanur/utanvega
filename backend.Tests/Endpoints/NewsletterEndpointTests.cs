using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using Moq.Protected;
using Utanvega.Backend.Infrastructure.Newsletter;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level test for <c>POST /api/v1/newsletter/subscribe</c> (#1641) — goes through the real
/// pipeline via <see cref="TestWebApplicationFactory"/>, replacing the singleton
/// <see cref="MailerLiteClientProvider"/> with one wired to a mocked <see cref="HttpMessageHandler"/>
/// so these prove what the endpoint actually sends back over HTTP, not just what
/// <see cref="MailerLiteClientProvider.SubscribeAsync"/> returns in isolation (covered separately in
/// <c>Services/MailerLiteClientProviderTests.cs</c>) — in particular, that a provider failure's raw
/// detail never reaches the HTTP response body.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class NewsletterEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private static Mock<HttpMessageHandler> MockHandlerReturning(HttpStatusCode statusCode, string body)
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() => new HttpResponseMessage
            {
                StatusCode = statusCode,
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        return handlerMock;
    }

    private HttpClient CreateClientWithMailerLiteBackedBy(HttpMessageHandler handler)
    {
        var factory = _factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<MailerLiteClientProvider>();

            var httpClientFactoryMock = new Mock<IHttpClientFactory>();
            httpClientFactoryMock.Setup(f => f.CreateClient("MailerLite")).Returns(new HttpClient(handler));

            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["MailerLite:ApiKey"] = "test-key",
                    ["MailerLite:GroupId"] = "group-123",
                })
                .Build();

            services.AddSingleton(new MailerLiteClientProvider(config, httpClientFactoryMock.Object));
        }));

        return factory.CreateClient();
    }

    [Fact]
    public async Task Subscribe_NewEmail_Returns200()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{\"data\":{\"id\":\"1\"}}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var response = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "new-runner@example.com" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // #1641 acceptance criterion: already-subscribed submits the same success response as new, not
    // an error.
    [Fact]
    public async Task Subscribe_AlreadySubscribedEmail_Returns200()
    {
        var handlerMock = MockHandlerReturning(
            HttpStatusCode.UnprocessableEntity, "{\"message\":\"The email has already been taken.\"}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var response = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "existing@example.com" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Subscribe_InvalidEmailFormat_Returns400WithoutCallingMailerLite()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.OK, "{}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var response = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "not-an-email" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // Covers the "provider-error-logged-not-leaked" acceptance criterion at the HTTP layer: a
    // MailerLite failure unrelated to "already subscribed" (here, an invalid API key) must come back
    // as a generic problem response — the raw response body MailerLite actually sent must never
    // appear anywhere in what the caller receives.
    [Fact]
    public async Task Subscribe_MailerLiteFailure_ReturnsGenericProblemWithoutLeakingRawDetail()
    {
        const string rawMailerLiteError = "Invalid API key: sk_live_super_secret_value_12345";
        var handlerMock = MockHandlerReturning(HttpStatusCode.Unauthorized, $"{{\"message\":\"{rawMailerLiteError}\"}}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var response = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "someone@example.com" });

        Assert.True((int)response.StatusCode >= 500 || (int)response.StatusCode == 400);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(rawMailerLiteError, body);
        Assert.DoesNotContain("sk_live_super_secret_value_12345", body);
    }
}

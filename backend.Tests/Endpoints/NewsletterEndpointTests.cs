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

    // #1644: server-side cap matching the frontend <TextField>'s maxLength=320
    // (frontend/pages/NewsletterPage.tsx) — the API must not accept anything the form itself blocks.
    [Fact]
    public async Task Subscribe_EmailOverLengthCap_Returns400WithoutCallingMailerLite()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.OK, "{}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        // 320 chars is the cap; this local part pushes the full address past it while still
        // parsing as a syntactically valid email, so the length check is what trips, not the format one.
        var overLongEmail = new string('a', 310) + "@example.com";

        var response = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = overLongEmail });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // #1647: a second submission of the same (normalized) email within the cooldown window must
    // short-circuit before ever calling MailerLite, and still answer with the identical 200 OK
    // shape as a first-time success — so a caller probing for "did this get rate-limited?" learns
    // nothing from the response itself.
    [Fact]
    public async Task Subscribe_SameEmailTwiceWithinCooldown_SecondCallSkipsMailerLiteButReturns200()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{\"data\":{\"id\":\"1\"}}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var first = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "cooldown@example.com" });
        var second = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "cooldown@example.com" });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        handlerMock.Protected().Verify("SendAsync", Times.Once(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // #1647 acceptance criterion: the cooldown check normalizes (trim + lowercase) before keying
    // the cache, so case/whitespace variants of the same address collapse to one entry rather than
    // each getting their own cooldown slot.
    [Fact]
    public async Task Subscribe_SameEmailDifferingByCaseAndWhitespace_TreatedAsSameForCooldown()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{\"data\":{\"id\":\"1\"}}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var first = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = " Test@X.com " });
        var second = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "test@x.com" });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        handlerMock.Protected().Verify("SendAsync", Times.Once(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // #1647 acceptance criterion: the per-email cooldown must not interact with or loosen the
    // existing per-IP limiter — two distinct emails from the same client are each independently
    // allowed through, each calling MailerLite once.
    [Fact]
    public async Task Subscribe_DifferentEmailsSameClient_AreEachIndependentlyAllowedThrough()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{\"data\":{\"id\":\"1\"}}");
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var first = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "runner-one@example.com" });
        var second = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "runner-two@example.com" });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        handlerMock.Protected().Verify("SendAsync", Times.Exactly(2), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // #1654: a failed MailerLite call must not arm the per-email cooldown — otherwise a legitimate
    // retry within the 5-minute window would hit the cooldown short-circuit and get a fake 200 OK
    // without MailerLite ever being called again. First call fails (401), second call (same email,
    // no cooldown wait needed) must still reach MailerLite and succeed.
    [Fact]
    public async Task Subscribe_FirstAttemptFails_RetrySameEmailStillReachesMailerLiteAndSucceeds()
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .SetupSequence<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.Unauthorized,
                Content = new StringContent("{\"message\":\"Invalid API key\"}", Encoding.UTF8, "application/json"),
            })
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.Created,
                Content = new StringContent("{\"data\":{\"id\":\"1\"}}", Encoding.UTF8, "application/json"),
            });
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var first = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "retry-after-failure@example.com" });
        var second = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "retry-after-failure@example.com" });

        Assert.True((int)first.StatusCode >= 500 || (int)first.StatusCode == 400);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        handlerMock.Protected().Verify("SendAsync", Times.Exactly(2), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
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

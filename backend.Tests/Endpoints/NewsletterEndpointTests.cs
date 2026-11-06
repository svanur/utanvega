using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Internal;
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

    // extraConfigureServices lets a single test layer on an additional service override (e.g. a
    // fake IMemoryCache clock, see Subscribe_SecondRequestArrivesNearHttpClientTimeoutCeiling_IsStillShortCircuited
    // below) without every other call site having to know about it.
    private HttpClient CreateClientWithMailerLiteBackedBy(
        HttpMessageHandler handler, Action<IServiceCollection>? extraConfigureServices = null)
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

            extraConfigureServices?.Invoke(services);
        }));

        return factory.CreateClient();
    }

    /// <summary>
    /// A mutable <see cref="ISystemClock"/> so a test can fast-forward the in-flight cooldown
    /// marker's cache clock without an actual wall-clock wait — see
    /// <see cref="Subscribe_SecondRequestArrivesNearHttpClientTimeoutCeiling_IsStillShortCircuited"/>.
    /// </summary>
    private sealed class FakeSystemClock : ISystemClock
    {
        public DateTimeOffset UtcNow { get; set; } = DateTimeOffset.UtcNow;
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

    // #1655: the cooldown's check-then-set was two separate IMemoryCache calls (TryGetValue, then
    // a later Set), so two requests for the same normalized email arriving close enough together
    // could both observe "not present" and both reach MailerLite before either Set landed. Firing
    // both via Task.WhenAll (rather than awaiting one before starting the other, as the in-flight
    // test below does) exercises that race directly — with NewsletterCooldownGate.TryArm making
    // the check-and-arm a single atomic step, exactly one of the two may ever win it.
    [Fact]
    public async Task Subscribe_TwoConcurrentRequestsSameEmail_OnlyOneReachesMailerLite()
    {
        var callCount = 0;
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .Returns<HttpRequestMessage, CancellationToken>((_, _) =>
            {
                Interlocked.Increment(ref callCount);
                return Task.FromResult(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.Created,
                    Content = new StringContent("{\"data\":{\"id\":\"1\"}}", Encoding.UTF8, "application/json"),
                });
            });
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var firstTask = client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "race@example.com" });
        var secondTask = client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "race@example.com" });
        var responses = await Task.WhenAll(firstTask, secondTask);

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal(1, callCount);
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

    // #1658 review: moving the cooldown Set to after the MailerLite call (to fix #1654) must not
    // reopen the rotating-IP "subscription bombing" window for the duration of that round trip. A
    // second request for the same email that arrives while the first is still in flight (MailerLite
    // hasn't responded yet) must be short-circuited by the short-lived in-flight marker, not reach
    // MailerLite a second time.
    [Fact]
    public async Task Subscribe_SecondRequestArrivesWhileFirstStillAwaitingMailerLite_IsShortCircuited()
    {
        var sendAsyncStarted = new TaskCompletionSource<bool>();
        var releaseFirstCall = new TaskCompletionSource<HttpResponseMessage>();
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .Returns<HttpRequestMessage, CancellationToken>((_, _) =>
            {
                sendAsyncStarted.TrySetResult(true);
                return releaseFirstCall.Task;
            });
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object);

        var firstTask = client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "inflight@example.com" });
        // Wait until the first request has actually reached MailerLite — the in-flight marker is
        // set synchronously before that call, so by this point it is already in the cache.
        await sendAsyncStarted.Task;

        var second = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "inflight@example.com" });
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        releaseFirstCall.SetResult(new HttpResponseMessage
        {
            StatusCode = HttpStatusCode.Created,
            Content = new StringContent("{\"data\":{\"id\":\"1\"}}", Encoding.UTF8, "application/json"),
        });
        var first = await firstTask;
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        handlerMock.Protected().Verify("SendAsync", Times.Once(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // #1659: the "MailerLite" HttpClient has an explicit 20s Timeout (Program.cs, builder.Services
    // .AddHttpClient("MailerLite")) specifically so it cannot still be outstanding once the 30s
    // in-flight marker above expires — before this fix the client had no Timeout at all and
    // defaulted to 100s, so a slow-but-real MailerLite call could outlive the marker and reopen the
    // #1658 race. The test above only proves the near-instant case (the first call never actually
    // elapses any time before the second request arrives); this one proves the marker still holds
    // once the *virtual* clock has advanced all the way to the HttpClient's 20s timeout ceiling — a
    // fake ISystemClock substituted into the test host's IMemoryCache advances time without an
    // actual 20-second wall-clock wait.
    [Fact]
    public async Task Subscribe_SecondRequestArrivesNearHttpClientTimeoutCeiling_IsStillShortCircuited()
    {
        var fakeClock = new FakeSystemClock();
        var sendAsyncStarted = new TaskCompletionSource<bool>();
        var releaseFirstCall = new TaskCompletionSource<HttpResponseMessage>();
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .Returns<HttpRequestMessage, CancellationToken>((_, _) =>
            {
                sendAsyncStarted.TrySetResult(true);
                return releaseFirstCall.Task;
            });
        var client = CreateClientWithMailerLiteBackedBy(handlerMock.Object, services =>
        {
            // Obsolete, but still the only hook IMemoryCache exposes for substituting its clock —
            // see FakeSystemClock's doc comment. Configuring it here (rather than replacing
            // IMemoryCache outright) lets AddMemoryCache() build the real MemoryCache the endpoint
            // resolves, just reading time from fakeClock instead of the system clock.
#pragma warning disable CS0618 // MemoryCacheOptions.Clock is obsolete in favor of TimeProvider, not yet available in this package version.
            services.Configure<MemoryCacheOptions>(o => o.Clock = fakeClock);
#pragma warning restore CS0618
        });

        var firstTask = client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "near-ceiling@example.com" });
        // Wait until the first request has actually armed the marker and reached MailerLite, same
        // as the near-instant test above.
        await sendAsyncStarted.Task;

        // Advance the cache's clock to exactly the HttpClient's configured Timeout (20s) — the
        // latest moment a well-behaved MailerLite call could still be outstanding. The marker's 30s
        // TTL must still cover this point for the fix to hold.
        fakeClock.UtcNow += TimeSpan.FromSeconds(20);

        var second = await client.PostAsJsonAsync("/api/v1/newsletter/subscribe", new { Email = "near-ceiling@example.com" });
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        releaseFirstCall.SetResult(new HttpResponseMessage
        {
            StatusCode = HttpStatusCode.Created,
            Content = new StringContent("{\"data\":{\"id\":\"1\"}}", Encoding.UTF8, "application/json"),
        });
        var first = await firstTask;
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        handlerMock.Protected().Verify("SendAsync", Times.Once(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
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

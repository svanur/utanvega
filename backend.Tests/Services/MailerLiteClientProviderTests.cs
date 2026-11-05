using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Moq;
using Moq.Protected;
using Utanvega.Backend.Infrastructure.Newsletter;

namespace Utanvega.Backend.Tests.Services;

// #1641: MailerLiteClientProvider mirrors DeepLTranslatorProvider's lazy-singleton shape, but also
// owns the subscribe call itself (unlike DeepLTranslatorProvider, which only hands back the
// DeepL.Translator and leaves the call site to Program.cs) — see the class's doc comment for why.
// These tests cover the three outcomes SubscribeAsync must distinguish: a plain success, MailerLite
// reporting "already subscribed" as a success rather than an error (owner-confirmed double opt-in
// requirement, #1641), and a provider failure whose raw detail is available for the caller to log
// but is never itself returned to a visitor.
public class MailerLiteClientProviderTests
{
    private static IConfiguration ConfigWith(string? apiKey, string? groupId = "group-123") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MailerLite:ApiKey"] = apiKey,
                ["MailerLite:GroupId"] = groupId,
            })
            .Build();

    private static Mock<HttpMessageHandler> MockHandlerReturning(HttpStatusCode statusCode, string body) =>
        MockHandler(_ => new HttpResponseMessage
        {
            StatusCode = statusCode,
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        });

    private static Mock<HttpMessageHandler> MockHandlerThrowing(Exception ex)
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(ex);
        return handlerMock;
    }

    private static Mock<HttpMessageHandler> MockHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync((HttpRequestMessage req, CancellationToken _) => respond(req));
        return handlerMock;
    }

    private static MailerLiteClientProvider BuildProvider(
        HttpMessageHandler handler, string? apiKey = "test-key", string? groupId = "group-123")
    {
        var httpClient = new HttpClient(handler);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient("MailerLite")).Returns(httpClient);
        return new MailerLiteClientProvider(ConfigWith(apiKey, groupId), factoryMock.Object);
    }

    [Fact]
    public async Task SubscribeAsync_MailerLiteAccepts_ReturnsSubscribed()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{\"data\":{\"id\":\"1\"}}");
        var provider = BuildProvider(handlerMock.Object);

        var result = await provider.SubscribeAsync("new-runner@example.com");

        Assert.Equal(MailerLiteSubscribeOutcome.Subscribed, result.Outcome);
        Assert.Null(result.ErrorDetail);
    }

    // #1641 acceptance criterion: an already-subscribed email submitted again must show the same
    // success/confirmation message as a brand-new subscribe, not an error — MailerLite's documented
    // "already in this group" 422 is the one non-2xx response this provider treats as success.
    [Fact]
    public async Task SubscribeAsync_MailerLiteReportsAlreadySubscribed_ReturnsAlreadySubscribed()
    {
        var handlerMock = MockHandlerReturning(
            HttpStatusCode.UnprocessableEntity,
            "{\"message\":\"The email has already been taken.\"}");
        var provider = BuildProvider(handlerMock.Object);

        var result = await provider.SubscribeAsync("existing-subscriber@example.com");

        Assert.Equal(MailerLiteSubscribeOutcome.AlreadySubscribed, result.Outcome);
    }

    // Any other non-success response (bad key, outage-shaped 5xx, unrelated validation error) must
    // come back as Failed with the raw response body attached for server-side logging only — the
    // endpoint converts this to a generic message before it ever reaches the caller.
    [Fact]
    public async Task SubscribeAsync_MailerLiteRejectsForAnOtherReason_ReturnsFailedWithRawDetail()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Unauthorized, "{\"message\":\"Invalid API key.\"}");
        var provider = BuildProvider(handlerMock.Object);

        var result = await provider.SubscribeAsync("someone@example.com");

        Assert.Equal(MailerLiteSubscribeOutcome.Failed, result.Outcome);
        Assert.NotNull(result.ErrorDetail);
        Assert.Contains("Invalid API key", result.ErrorDetail);
    }

    // A network-level failure (DNS, timeout, connection reset) must propagate as an exception
    // rather than being swallowed into a Failed result — the endpoint's own try/catch is what
    // logs it via logger.LogError(ex, ...), matching SubmitFeedback's shape (Program.cs).
    [Fact]
    public async Task SubscribeAsync_NetworkFailure_PropagatesException()
    {
        var handlerMock = MockHandlerThrowing(new HttpRequestException("MailerLite unreachable"));
        var provider = BuildProvider(handlerMock.Object);

        await Assert.ThrowsAsync<HttpRequestException>(() => provider.SubscribeAsync("someone@example.com"));
    }

    [Fact]
    public async Task SubscribeAsync_ApiKeyNotConfigured_ReturnsFailedWithoutMakingAnHttpCall()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.OK, "{}");
        var provider = BuildProvider(handlerMock.Object, apiKey: null);

        var result = await provider.SubscribeAsync("someone@example.com");

        Assert.Equal(MailerLiteSubscribeOutcome.Failed, result.Outcome);
        Assert.False(provider.IsConfigured);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }
}

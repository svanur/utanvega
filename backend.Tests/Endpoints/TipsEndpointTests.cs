using System.Net;
using System.Net.Http.Json;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level test for <c>POST /api/v1/tips</c> (Program.cs:2433-2457) — see #1118/#1119.
///
/// Before #1118's fix, this endpoint's only <c>catch</c> block was a generic
/// <c>catch (Exception ex) { return Results.Problem(...); }</c> with no preceding
/// <c>catch (ValidationException ex)</c>, so a <c>SendTipCommandValidator</c> rejection (thrown
/// by <see cref="Utanvega.Backend.Application.Validation.ValidationBehavior{TRequest,TResponse}"/>)
/// fell through to that generic handler and came back as a 500. This test goes through the real
/// pipeline — via <see cref="TestWebApplicationFactory"/>, not a handler in isolation — so it
/// actually proves the endpoint's local catch block now matches the shared validation-problem
/// shape, using <see cref="Utanvega.Backend.Application.Validation.ValidationProblemResult.ToProblem"/>.
///
/// Mirrors <see cref="FeedbackEndpointTests"/>, which exercises the same fix shape for
/// <c>/api/v1/feedback</c>.
///
/// <c>/api/v1/tips</c> has no <c>[Authorize]</c> attribute, so a plain, unauthenticated
/// <see cref="TestWebApplicationFactory.CreateClient"/> is enough — there's no admin policy to
/// satisfy here, unlike <see cref="LocationEndpointTests"/>.
///
/// <c>/api/v1/tips</c> is rate-limited to 5 requests per 10 minutes (Program.cs:407-414); this
/// test makes a single call, well under that limit.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class TipsEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task SendTip_NonHttpPageUrl_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateClient();

        // "ftp://example.com/page" is a well-formed absolute URI, so it clears the endpoint's own
        // manual string.IsNullOrWhiteSpace guard (Program.cs:2438-2439, out of scope for #1119) and
        // reaches SendTipCommandValidator, whose Must(...) rule rejects anything but an http/https
        // scheme (SendTipCommand.cs:13-18) — the failure this test needs.
        var response = await client.PostAsJsonAsync(
            "/api/v1/tips",
            new
            {
                PageUrl = "ftp://example.com/page",
                Message = "Something could be improved on this page.",
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("PageUrl"));
        Assert.Contains("PageUrl must be a valid HTTP or HTTPS URL.", body.Errors["PageUrl"]);
    }
}

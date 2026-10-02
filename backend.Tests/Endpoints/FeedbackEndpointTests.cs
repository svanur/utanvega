using System.Net;
using System.Net.Http.Json;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level test for <c>POST /api/v1/feedback</c> (Program.cs:2441-2469) — see #1112.
///
/// Before this fix, that endpoint's only <c>catch</c> block was a generic
/// <c>catch (Exception ex) { return Results.Problem(...); }</c> with no preceding
/// <c>catch (ValidationException ex)</c>, so a <c>SubmitFeedbackCommandValidator</c> rejection (thrown
/// by <see cref="Utanvega.Backend.Application.Validation.ValidationBehavior{TRequest,TResponse}"/>)
/// fell through to that generic handler and came back as a 500, even though the global middleware
/// (Program.cs:522-537) would have turned the very same exception into a structured 400 if it had
/// been allowed to propagate past the endpoint. This test goes through the real pipeline — via
/// <see cref="TestWebApplicationFactory"/>, not a handler in isolation — so it actually proves the
/// endpoint's local catch block now matches the global middleware's shape, using
/// <see cref="Utanvega.Backend.Application.Validation.ValidationProblemResult.ToProblem"/>.
///
/// <c>/api/v1/feedback</c> has no <c>[Authorize]</c> attribute, so a plain, unauthenticated
/// <see cref="TestWebApplicationFactory.CreateClient"/> is enough — there's no admin policy to
/// satisfy here, unlike <see cref="LocationEndpointTests"/>.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class FeedbackEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task SubmitFeedback_NonHttpPageUrl_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateClient();

        // "ftp://example.com/page" is a well-formed absolute URI, so it clears the endpoint's own
        // manual string.IsNullOrWhiteSpace guard (Program.cs:2445-2446, out of scope for #1112) and
        // reaches SubmitFeedbackCommandValidator, whose Must(...) rule rejects anything but an
        // http/https scheme (SubmitFeedbackCommandValidator.cs:12-14) — the failure this test needs.
        var response = await client.PostAsJsonAsync(
            "/api/v1/feedback",
            new
            {
                PageUrl = "ftp://example.com/page",
                Message = "Something is broken on this page.",
                Category = (string?)null,
                Name = (string?)null,
                Email = (string?)null,
                StepsToReproduce = (string?)null,
                BrowserInfo = (string?)null,
                ScreenshotUrl = (string?)null,
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("PageUrl"));
        Assert.Contains("PageUrl must be a valid HTTP or HTTPS URL.", body.Errors["PageUrl"]);
    }

    private record ValidationErrorBody(string Title, Dictionary<string, string[]> Errors);
}

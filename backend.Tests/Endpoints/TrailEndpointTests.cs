using System.Net;
using System.Net.Http.Json;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level test for <c>POST /api/v1/admin/trails/check-similarity</c>
/// (Program.cs:1131-1163) — see #1113, auditing the same bug class #1112 fixed for
/// <c>/api/v1/feedback</c>.
///
/// Before this fix, that endpoint's only <c>catch</c> block was a generic
/// <c>catch (Exception ex) { return Results.Problem(...); }</c> with no preceding
/// <c>catch (ValidationException ex)</c>, so a <c>CheckTrailSimilarityCommandValidator</c>
/// rejection (thrown by
/// <see cref="Utanvega.Backend.Application.Validation.ValidationBehavior{TRequest,TResponse}"/>)
/// fell through to that generic handler and came back as a 500, even though the global middleware
/// (Program.cs:522-537) would have turned the very same exception into a structured 400 if it had
/// been allowed to propagate past the endpoint. This test goes through the real pipeline — via
/// <see cref="TestWebApplicationFactory"/>, not a handler in isolation — so it actually proves the
/// endpoint's local catch block now matches the global middleware's shape, using
/// <see cref="Utanvega.Backend.Application.Validation.ValidationProblemResult.ToProblem"/>.
///
/// <c>check-similarity</c> is <c>[Authorize(Policy = "AdminOnly")]</c>, unlike
/// <c>/api/v1/feedback</c>, so this uses <see cref="TestWebApplicationFactory.CreateAuthenticatedClient"/>
/// (default <c>role: "admin"</c> already satisfies <c>AdminOnly</c>) rather than a plain
/// <see cref="TestWebApplicationFactory.CreateClient"/> — see <see cref="LocationEndpointTests"/>
/// for the same pattern.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class TrailEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task CheckTrailSimilarity_NameOver200Chars_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateAuthenticatedClient("admin-user");

        // The endpoint's own manual guard (Program.cs:1133) only rejects a missing/empty file, so a
        // non-empty file (its GPX content never needs to be valid — validation runs before any GPX
        // parsing) reaches CheckTrailSimilarityCommandValidator, whose MaximumLength(200) rule on
        // Name is the reachable failure case named in #1113's work order.
        var overlongName = new string('a', 201);
        using var content = new MultipartFormDataContent();
        using var fileContent = new StringContent("not actually valid gpx content");
        content.Add(fileContent, "file", "trail.gpx");

        var response = await client.PostAsync(
            $"/api/v1/admin/trails/check-similarity?name={overlongName}",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("Name"));
    }

    private record ValidationErrorBody(string Title, Dictionary<string, string[]> Errors);
}

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

    /// <summary>
    /// Endpoint-level test for <c>PUT /api/v1/admin/trails/{id}/gpx</c> (Program.cs:1108-1128) —
    /// see #1122, auditing the same bug class #1113/#1114/#1115 covered elsewhere in the
    /// Trails/Locations family but missed for this endpoint and for <c>DeleteLocation</c>.
    ///
    /// Before this fix, the endpoint's only <c>catch</c> block was a generic
    /// <c>catch (Exception ex) { return Results.Problem(...); }</c> with no preceding
    /// <c>catch (ValidationException ex)</c>, so a new
    /// <see cref="Utanvega.Backend.Application.Trails.Commands.UpdateTrailGpx.UpdateTrailGpxCommandValidator"/>
    /// rejection (thrown by
    /// <see cref="Utanvega.Backend.Application.Validation.ValidationBehavior{TRequest,TResponse}"/>)
    /// would have fallen through to that generic handler and come back as an unstructured 500-shaped
    /// <c>Results.Problem()</c>, instead of the structured 400 the global middleware would have
    /// produced for the same exception. The trail id in the route does not need to resolve to a real
    /// row: <see cref="Utanvega.Backend.Application.Validation.ValidationBehavior{TRequest,TResponse}"/>
    /// runs ahead of the handler in the MediatR pipeline and throws before the (non-existent) trail
    /// is ever looked up.
    /// </summary>
    [Fact]
    public async Task UpdateTrailGpx_WhitespaceOnlyGpxContent_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateAuthenticatedClient("admin-user");

        // The endpoint's own manual guard (Program.cs:1110) only rejects a missing/zero-length file.
        // Whitespace-only content has bytes, so it passes that guard and reaches
        // UpdateTrailGpxCommandValidator's NotEmpty() rule on GpxXml, which trims before comparing.
        using var content = new MultipartFormDataContent();
        using var fileContent = new StringContent("   ");
        content.Add(fileContent, "file", "trail.gpx");

        var response = await client.PutAsync(
            $"/api/v1/admin/trails/{Guid.NewGuid()}/gpx",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("GpxXml"));
    }

    /// <summary>
    /// Endpoint-level test for <c>POST /api/v1/admin/trails/upload-gpx</c> (Program.cs:1051-1106) —
    /// see #1137, auditing the same bug class #1113/#1114/#1115/#1122 covered elsewhere in the
    /// Trails family. <c>check-similarity</c> (above) was already covered by #1113, but the sibling
    /// <c>upload-gpx</c> endpoint — which shares the exact same
    /// <c>catch (ValidationException ex) { return ex.ToProblem(); }</c> block — was missed.
    ///
    /// <c>name</c>/<c>activityType</c> are query-string parameters, not form fields (see
    /// admin/src/components/GpxUploadDialog.tsx:138), so they ride on the URL the same way
    /// <c>CheckTrailSimilarity</c>'s test above does.
    /// </summary>
    [Fact]
    public async Task CreateTrailFromGpx_WhitespaceOnlyGpxContent_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateAuthenticatedClient("admin-user");

        // The endpoint's own manual guard (Program.cs:1053) only rejects a missing/zero-length
        // file, and activityType is validated manually too (Program.cs:1058-1065) — both pass here
        // so the whitespace-only GPX content reaches CreateTrailFromGpxCommandValidator's
        // NotEmpty() rule on GpxXml, which trims before comparing.
        using var content = new MultipartFormDataContent();
        using var fileContent = new StringContent("   ");
        content.Add(fileContent, "file", "trail.gpx");

        var response = await client.PostAsync(
            "/api/v1/admin/trails/upload-gpx?name=Test+Trail&activityType=Hiking",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("GpxXml"));
    }

    /// <summary>
    /// Endpoint-level test for <c>POST /api/v1/admin/trails/bulk-check-similarity</c>
    /// (Program.cs:1172-1222) — see #1137. Same gap as <c>CreateTrailFromGpx</c> above: the
    /// endpoint's own manual guard (Program.cs:1178) only rejects an empty <c>files</c> list, so a
    /// single whitespace-only file reaches <c>BulkCheckTrailSimilarityCommandValidator</c>'s
    /// <c>RuleForEach(x => x.Files).ChildRules(...)</c> NotEmpty() rule on <c>GpxXml</c>. FluentValidation
    /// names a per-element child-rule failure with the collection index baked in, so the key is
    /// <c>"Files[0].GpxXml"</c>, not a plain <c>"GpxXml"</c> — confirmed by inspecting the actual
    /// response body rather than assumed.
    /// </summary>
    [Fact]
    public async Task BulkCheckTrailSimilarity_WhitespaceOnlyGpxContent_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateAuthenticatedClient("admin-user");

        using var content = new MultipartFormDataContent();
        using var fileContent = new StringContent("   ");
        content.Add(fileContent, "files", "trail.gpx");

        var response = await client.PostAsync(
            "/api/v1/admin/trails/bulk-check-similarity",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("Files[0].GpxXml"));
    }

    /// <summary>
    /// Endpoint-level test for <c>POST /api/v1/admin/trails/bulk-upload-gpx</c> (Program.cs:1224-1268)
    /// — see #1137. Same gap and same nested-rule key shape as <c>BulkCheckTrailSimilarity</c> above:
    /// the endpoint's own manual guards (Program.cs:1231, 1240) only reject an empty <c>files</c>
    /// list and a missing/invalid <c>activityTypes</c> entry — both pass here — so the whitespace-only
    /// file reaches <c>BulkCreateTrailsFromGpxCommandValidator</c>'s
    /// <c>RuleForEach(x => x.Files).ChildRules(...)</c> NotEmpty() rule on <c>GpxXml</c>, keyed as
    /// <c>"Files[0].GpxXml"</c>.
    /// </summary>
    [Fact]
    public async Task BulkCreateTrailsFromGpx_WhitespaceOnlyGpxContent_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateAuthenticatedClient("admin-user");

        using var content = new MultipartFormDataContent();
        using var fileContent = new StringContent("   ");
        content.Add(fileContent, "files", "trail.gpx");
        content.Add(new StringContent("Hiking"), "activityTypes");

        var response = await client.PostAsync(
            "/api/v1/admin/trails/bulk-upload-gpx",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("Files[0].GpxXml"));
    }
}

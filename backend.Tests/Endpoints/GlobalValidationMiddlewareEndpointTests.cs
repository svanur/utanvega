using System.Net;
using System.Net.Http.Json;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level test for the global exception-handling middleware's
/// <c>catch (ValidationException ex)</c> branch (Program.cs:522-531) — see #1120.
///
/// Unlike <see cref="FeedbackEndpointTests"/> and <see cref="TrailEndpointTests"/>, which exercise
/// endpoints that catch <c>ValidationException</c> locally and call
/// <see cref="Utanvega.Backend.Application.Validation.ValidationProblemResult.ToProblem"/>
/// themselves, <c>PUT /api/v1/admin/locations/{id}</c> (Program.cs:1293-1300, <c>UpdateLocation</c>)
/// has no local catch at all around its <c>mediator.Send</c> call — a
/// <c>UpdateLocationCommandValidator</c> rejection (thrown by
/// <see cref="Utanvega.Backend.Application.Validation.ValidationBehavior{TRequest,TResponse}"/>)
/// propagates all the way up through the endpoint and is only ever handled by the global
/// middleware. #1120 replaced that middleware's independent inline
/// <c>GroupBy</c>/<c>ToDictionary</c>/<c>WriteAsJsonAsync</c> copy of the <c>{ title, errors }</c>
/// shape with a call to <c>ex.ToProblem().ExecuteAsync(context)</c> — this test proves the response
/// is unchanged after that swap, going through the real pipeline via
/// <see cref="TestWebApplicationFactory"/> rather than a handler in isolation.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class GlobalValidationMiddlewareEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task UpdateLocation_InvalidSlug_Returns400WithStructuredValidationBodyViaGlobalMiddleware()
    {
        // UpdateLocation (Program.cs:1293-1300) has no local try/catch around mediator.Send, so this
        // exercises the global middleware's ValidationException handler specifically, not an
        // endpoint-level ToProblem() call like FeedbackEndpointTests/TrailEndpointTests do.
        // ValidationBehavior runs before the handler (it's a MediatR pipeline behavior), so no
        // location row needs to exist for the validator's rejection to be reached.
        var locationId = Guid.NewGuid();
        var client = _factory.CreateAuthenticatedClient("admin-user");

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/locations/{locationId}",
            new
            {
                Id = locationId,
                Name = "Updated Name",
                // Fails UpdateLocationCommandValidator's Slug regex (lowercase alphanumeric + hyphens
                // only) — UpdateLocationCommandValidator.cs:17-21.
                Slug = "Invalid Slug!",
                Description = (string?)null,
                Type = "Place",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                UpdatedBy = "admin-user",
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        // #1128: assert the full header, not just .MediaType — .MediaType strips the charset
        // parameter, so it would pass regardless of whether the charset is present. ToProblem()
        // (ValidationProblemResult.cs:18) calls Results.Json() with no explicit Content-Type,
        // which ASP.NET Core defaults to "application/json; charset=utf-8" — accepted as correct
        // going forward (arguably more correct than the pre-#1120 inline middleware's bare
        // "application/json" with no charset).
        Assert.Equal("application/json; charset=utf-8", response.Content.Headers.ContentType?.ToString());

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("Slug"));
        Assert.Contains("Slug must be lowercase alphanumeric with hyphens only.", body.Errors["Slug"]);
    }
}

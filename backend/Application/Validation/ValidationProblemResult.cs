using FluentValidation;

namespace Utanvega.Backend.Application.Validation;

public static class ValidationProblemResult
{
    // Builds the same { title, errors } shape the global exception-handling middleware
    // (Program.cs) already produces for an unhandled ValidationException, so endpoints
    // that catch ValidationException locally (e.g. because they need to return a
    // different success shape, or sit ahead of the middleware for some other reason)
    // can return an identical 400 body instead of falling through to a generic 500.
    public static IResult ToProblem(this ValidationException ex)
    {
        var errors = ex.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

        return Results.Json(new { title = "Validation failed", errors }, statusCode: 400);
    }
}

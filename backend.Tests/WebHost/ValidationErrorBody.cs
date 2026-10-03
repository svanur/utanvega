namespace Utanvega.Backend.Tests.WebHost;

/// <summary>
/// Shared shape for deserializing the structured 400 validation-problem response produced by
/// <see cref="Utanvega.Backend.Application.Validation.ValidationProblemResult.ToProblem"/> (the
/// endpoint-local path) and the global middleware's equivalent branch (Program.cs:522-531) —
/// both emit the same <c>{ title, errors }</c> shape. Previously duplicated as an identical private
/// record in four files under <c>backend.Tests/Endpoints/</c>
/// (<c>FeedbackEndpointTests</c>, <c>TrailEndpointTests</c>, <c>TipsEndpointTests</c>,
/// <c>GlobalValidationMiddlewareEndpointTests</c>) — see #1126.
/// </summary>
public record ValidationErrorBody(string Title, Dictionary<string, string[]> Errors);

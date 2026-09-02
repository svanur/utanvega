using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

namespace Utanvega.Backend.Application.Trails.Commands.CheckTrailSimilarity;

public record CheckTrailSimilarityResult(List<TrailSimilarityMatch> Matches, ActivityType? DetectedActivityType);

public record CheckTrailSimilarityCommand(string? Name, string GpxXml) : IRequest<CheckTrailSimilarityResult>;

public class CheckTrailSimilarityCommandHandler : IRequestHandler<CheckTrailSimilarityCommand, CheckTrailSimilarityResult>
{
    private readonly CreateTrailFromGpxCommandHandler _createHandler;

    public CheckTrailSimilarityCommandHandler(CreateTrailFromGpxCommandHandler createHandler)
    {
        _createHandler = createHandler;
    }

    public async Task<CheckTrailSimilarityResult> Handle(CheckTrailSimilarityCommand request, CancellationToken cancellationToken)
    {
        var (trail, detectedActivityType) = _createHandler.ProcessGpxWithDetection(request.Name, request.GpxXml);
        var matches = await _createHandler.CheckSimilarityAsync(trail, cancellationToken);
        return new CheckTrailSimilarityResult(matches, detectedActivityType);
    }
}

using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

namespace Utanvega.Backend.Application.Trails.Commands.BulkCheckTrailSimilarity;

public record BulkCheckTrailSimilarityResult(string FileName, string? Name, List<TrailSimilarityMatch> Matches, ActivityType? DetectedActivityType);

public record BulkCheckTrailSimilarityCommand(List<GpxFileInfo> Files) : IRequest<List<BulkCheckTrailSimilarityResult>>;

public record GpxFileInfo(string? Name, string GpxXml, string FileName);

public class BulkCheckTrailSimilarityCommandHandler : IRequestHandler<BulkCheckTrailSimilarityCommand, List<BulkCheckTrailSimilarityResult>>
{
    private readonly CreateTrailFromGpxCommandHandler _singleHandler;
    private readonly ILogger<BulkCheckTrailSimilarityCommandHandler> _logger;

    public BulkCheckTrailSimilarityCommandHandler(CreateTrailFromGpxCommandHandler singleHandler, ILogger<BulkCheckTrailSimilarityCommandHandler> logger)
    {
        _singleHandler = singleHandler;
        _logger = logger;
    }

    public async Task<List<BulkCheckTrailSimilarityResult>> Handle(BulkCheckTrailSimilarityCommand request, CancellationToken cancellationToken)
    {
        var results = new List<BulkCheckTrailSimilarityResult>();

        foreach (var file in request.Files)
        {
            try
            {
                var (trail, detectedActivityType) = _singleHandler.ProcessGpxWithDetection(file.Name, file.GpxXml);
                var matches = await _singleHandler.CheckSimilarityAsync(trail, cancellationToken);
                results.Add(new BulkCheckTrailSimilarityResult(file.FileName, trail.Name, matches, detectedActivityType));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Similarity check failed for file {FileName}", file.FileName);
                // We add an empty result or error info for this file so we don't block the whole batch
                results.Add(new BulkCheckTrailSimilarityResult(file.FileName, file.Name, new List<TrailSimilarityMatch>(), null));
            }
        }

        return results;
    }
}

using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

namespace Utanvega.Backend.Application.Trails.Commands.CheckTrailSimilarity;

public record CheckTrailSimilarityCommand(string? Name, string GpxXml) : IRequest<List<TrailSimilarityMatch>>;

public class CheckTrailSimilarityCommandHandler : IRequestHandler<CheckTrailSimilarityCommand, List<TrailSimilarityMatch>>
{
    private readonly CreateTrailFromGpxCommandHandler _createHandler;

    public CheckTrailSimilarityCommandHandler(CreateTrailFromGpxCommandHandler createHandler)
    {
        _createHandler = createHandler;
    }

    public async Task<List<TrailSimilarityMatch>> Handle(CheckTrailSimilarityCommand request, CancellationToken cancellationToken)
    {
        var trail = _createHandler.ProcessGpx(request.Name, request.GpxXml);
        return await _createHandler.CheckSimilarityAsync(trail, cancellationToken);
    }
}

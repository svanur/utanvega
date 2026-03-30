using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.BulkTrailAction;

public enum BulkTrailActionType
{
    Delete,
    UpdateStatus,
    UpdateDifficulty,
    UpdateVisibility
}

public record BulkTrailActionCommand(
    List<Guid> Ids, 
    BulkTrailActionType Action, 
    string? Value = null) : IRequest<int>;

public class BulkTrailActionCommandHandler : IRequestHandler<BulkTrailActionCommand, int>
{
    private readonly UtanvegaDbContext _context;

    public BulkTrailActionCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(BulkTrailActionCommand request, CancellationToken cancellationToken)
    {
        if (request.Ids == null || !request.Ids.Any())
            return 0;

        var trails = await _context.Trails
            .Where(t => request.Ids.Contains(t.Id))
            .ToListAsync(cancellationToken);

        if (!trails.Any())
            return 0;

        foreach (var trail in trails)
        {
            switch (request.Action)
            {
                case BulkTrailActionType.Delete:
                    trail.Status = TrailStatus.Deleted;
                    break;
                case BulkTrailActionType.UpdateStatus:
                    if (Enum.TryParse<TrailStatus>(request.Value, true, out var status))
                    {
                        trail.Status = status;
                    }
                    break;
                case BulkTrailActionType.UpdateDifficulty:
                    if (Enum.TryParse<Difficulty>(request.Value, true, out var difficulty))
                    {
                        trail.Difficulty = difficulty;
                    }
                    break;
                case BulkTrailActionType.UpdateVisibility:
                    if (Enum.TryParse<Visibility>(request.Value, true, out var visibility))
                    {
                        trail.Visibility = visibility;
                    }
                    break;
            }
            trail.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesWithAuditAsync("system");
        
        return trails.Count;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.RecordTrailView;

public record RecordTrailViewCommand(string Slug, string? IpHash = null) : IRequest<bool>;

public class RecordTrailViewCommandHandler : IRequestHandler<RecordTrailViewCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private static readonly TimeSpan DeduplicationWindow = TimeSpan.FromMinutes(30);

    public RecordTrailViewCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(RecordTrailViewCommand request, CancellationToken cancellationToken)
    {
        var trailId = await _context.Trails
            .Where(t => t.Slug == request.Slug && t.Status == TrailStatus.Published)
            .Select(t => t.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (trailId == Guid.Empty) return false;

        // Deduplicate: skip if same IP viewed same trail within the last 30 minutes
        if (!string.IsNullOrEmpty(request.IpHash))
        {
            var cutoff = DateTime.UtcNow - DeduplicationWindow;
            var recentView = await _context.TrailViews
                .AnyAsync(v => v.TrailId == trailId
                    && v.IpHash == request.IpHash
                    && v.ViewedAtUtc >= cutoff, cancellationToken);

            if (recentView) return true; // Already counted, return success
        }

        _context.TrailViews.Add(new TrailView
        {
            TrailId = trailId,
            ViewedAtUtc = DateTime.UtcNow,
            IpHash = request.IpHash,
        });

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

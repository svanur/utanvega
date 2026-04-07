using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.RecordTrailView;

public record RecordTrailViewCommand(string Slug) : IRequest<bool>;

public class RecordTrailViewCommandHandler : IRequestHandler<RecordTrailViewCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public RecordTrailViewCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(RecordTrailViewCommand request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .Where(t => t.Slug == request.Slug && t.Status == TrailStatus.Published)
            .Select(t => t.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (trail == Guid.Empty) return false;

        _context.TrailViews.Add(new TrailView
        {
            TrailId = trail,
            ViewedAtUtc = DateTime.UtcNow,
        });

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.DeleteTrail;

public record DeleteTrailCommand(Guid Id) : IRequest<bool>;

public class DeleteTrailCommandHandler : IRequestHandler<DeleteTrailCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public DeleteTrailCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteTrailCommand request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);
        if (trail == null) return false;

        _context.Trails.Remove(trail);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

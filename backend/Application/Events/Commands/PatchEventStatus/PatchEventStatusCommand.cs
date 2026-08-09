using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.PatchEventStatus;

public record PatchEventStatusCommand(Guid Id, string Status) : IRequest<bool>;

public class PatchEventStatusCommandHandler : IRequestHandler<PatchEventStatusCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public PatchEventStatusCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(PatchEventStatusCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev is null) return false;

        if (!Enum.TryParse<EventStatus>(request.Status, out var status)) return false;

        ev.Status = status;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Photographers;

public record DeletePhotographerCommand(Guid Id) : IRequest<bool>;

public class DeletePhotographerCommandHandler : IRequestHandler<DeletePhotographerCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public DeletePhotographerCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeletePhotographerCommand request, CancellationToken cancellationToken)
    {
        var photographer = await _context.Photographers.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (photographer is null) return false;

        // No FK references Photographer yet — PhotoGallery (#489) is still blocked on this issue.
        // This handler is shaped the same as DeleteOrganizerCommandHandler (look up, then clear any
        // dependent references before removing) so #489 can add the gallery-reference-nulling step
        // here without restructuring the handler.

        _context.Photographers.Remove(photographer);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

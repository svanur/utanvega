using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Organizers;

public record DeleteOrganizerCommand(Guid Id) : IRequest<bool>;

public class DeleteOrganizerCommandHandler : IRequestHandler<DeleteOrganizerCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public DeleteOrganizerCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteOrganizerCommand request, CancellationToken cancellationToken)
    {
        var organizer = await _context.Organizers.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
        if (organizer is null) return false;

        _context.Organizers.Remove(organizer);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

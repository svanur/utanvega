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

        await _context.Events
            .Where(e => e.OrganizerId == request.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.OrganizerName, (string?)null)
                .SetProperty(e => e.OrganizerNameEn, (string?)null)
                .SetProperty(e => e.OrganizerWebsite, (string?)null),
                cancellationToken);

        _context.Organizers.Remove(organizer);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

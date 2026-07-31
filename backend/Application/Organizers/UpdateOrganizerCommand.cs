using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Organizers;

public record UpdateOrganizerCommand(
    Guid Id,
    string Name,
    string? Kennitala,
    string? Phone,
    string? Email,
    string? Website,
    string? Description,
    string? ContactName
) : IRequest<bool>;

public class UpdateOrganizerCommandHandler : IRequestHandler<UpdateOrganizerCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public UpdateOrganizerCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateOrganizerCommand request, CancellationToken cancellationToken)
    {
        var organizer = await _context.Organizers.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
        if (organizer is null) return false;

        organizer.Name = request.Name;
        organizer.Kennitala = request.Kennitala;
        organizer.Phone = request.Phone;
        organizer.Email = request.Email;
        organizer.Website = request.Website;
        organizer.Description = request.Description;
        organizer.ContactName = request.ContactName;
        organizer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

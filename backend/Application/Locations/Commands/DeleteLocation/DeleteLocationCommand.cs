using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Commands.DeleteLocation;

public record DeleteLocationCommand(Guid Id) : IRequest;

public class DeleteLocationCommandHandler : IRequestHandler<DeleteLocationCommand>
{
    private readonly UtanvegaDbContext _context;

    public DeleteLocationCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task Handle(DeleteLocationCommand request, CancellationToken cancellationToken)
    {
        var location = await _context.Locations
            .Include(l => l.Children)
            .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

        if (location == null)
            throw new Exception("Location not found");

        if (location.Children.Any())
            throw new Exception("Cannot delete a location that has children. Delete or move children first.");

        _context.Locations.Remove(location);
        await _context.SaveChangesWithAuditAsync("system");
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Commands.DeleteLocation;

public record DeleteLocationCommand(Guid Id, string? ActorUserId = null) : IRequest;

public class DeleteLocationCommandHandler : IRequestHandler<DeleteLocationCommand>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeleteLocationCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task Handle(DeleteLocationCommand request, CancellationToken cancellationToken)
    {
        var location = await _context.Locations
            .Include(l => l.Children)
            .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

        if (location == null)
            throw new InvalidOperationException($"Location {request.Id} does not exist.");

        if (location.Children.Any())
            throw new InvalidOperationException("Cannot delete a location that has children. Delete or move children first.");

        var slug = location.Slug;
        _context.Locations.Remove(location);
        await _context.SaveChangesWithAuditAsync(request.ActorUserId);
        _cacheInvalidator.InvalidateLocation(slug);
    }
}

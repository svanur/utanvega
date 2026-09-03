using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Photographers;

public record DeletePhotographerCommand(Guid Id, Guid? ReassignToPhotographerId = null) : IRequest<bool>;

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

        // PhotoGallery.PhotographerId is a nullable FK with OnDelete(SetNull) (see UtanvegaDbContext),
        // so a plain delete already clears attribution at the DB level with no manual step needed
        // here — unlike Organizer's denormalized-field case in DeleteOrganizerCommandHandler.
        // When the caller supplies a reassignment target, the gallery move and the photographer
        // delete must succeed or fail together (no partial state where galleries have moved but the
        // photographer still exists, or vice versa), so both go through one explicit transaction.
        if (request.ReassignToPhotographerId is { } targetId && targetId != request.Id)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            await _context.PhotoGalleries
                .Where(g => g.PhotographerId == request.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(g => g.PhotographerId, targetId), cancellationToken);

            _context.Photographers.Remove(photographer);
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return true;
        }

        _context.Photographers.Remove(photographer);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

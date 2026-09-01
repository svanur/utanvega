using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.PhotoGalleries;

public record DeletePhotoGalleryCommand(Guid Id) : IRequest<bool>;

public class DeletePhotoGalleryCommandHandler : IRequestHandler<DeletePhotoGalleryCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public DeletePhotoGalleryCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeletePhotoGalleryCommand request, CancellationToken cancellationToken)
    {
        var gallery = await _context.PhotoGalleries.FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);
        if (gallery is null) return false;

        _context.PhotoGalleries.Remove(gallery);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

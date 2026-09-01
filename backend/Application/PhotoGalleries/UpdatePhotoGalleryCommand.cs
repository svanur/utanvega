using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.PhotoGalleries;

public record UpdatePhotoGalleryCommand(
    Guid Id,
    string Url,
    Guid? PhotographerId,
    string? Title,
    string? TitleEn = null,
    int SortOrder = 0
) : IRequest<bool>;

public class UpdatePhotoGalleryCommandHandler : IRequestHandler<UpdatePhotoGalleryCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public UpdatePhotoGalleryCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdatePhotoGalleryCommand request, CancellationToken cancellationToken)
    {
        var gallery = await _context.PhotoGalleries.FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);
        if (gallery is null) return false;

        gallery.Url = request.Url;
        gallery.PhotographerId = request.PhotographerId;
        gallery.Title = request.Title;
        gallery.TitleEn = request.TitleEn;
        gallery.SortOrder = request.SortOrder;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.PhotoGalleries;

public record CreatePhotoGalleryCommand(
    Guid EventEditionId,
    string Url,
    Guid? PhotographerId,
    string? Title,
    string? TitleEn = null,
    int SortOrder = 0,
    string? CreatedBy = null
) : IRequest<Guid>;

public class CreatePhotoGalleryCommandHandler : IRequestHandler<CreatePhotoGalleryCommand, Guid>
{
    private readonly UtanvegaDbContext _context;

    public CreatePhotoGalleryCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<Guid> Handle(CreatePhotoGalleryCommand request, CancellationToken cancellationToken)
    {
        var gallery = new PhotoGallery
        {
            EventEditionId = request.EventEditionId,
            Url = request.Url,
            PhotographerId = request.PhotographerId,
            Title = request.Title,
            TitleEn = request.TitleEn,
            SortOrder = request.SortOrder,
            CreatedBy = request.CreatedBy,
        };

        _context.PhotoGalleries.Add(gallery);
        await _context.SaveChangesAsync(cancellationToken);

        return gallery.Id;
    }
}

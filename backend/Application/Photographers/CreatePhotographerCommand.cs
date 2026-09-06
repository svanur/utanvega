using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Photographers;

public record CreatePhotographerCommand(
    string Name,
    string? Website,
    string? Email,
    string? Description,
    string? DescriptionEn = null
) : IRequest<(Guid Id, string Slug)>;

public class CreatePhotographerCommandHandler : IRequestHandler<CreatePhotographerCommand, (Guid Id, string Slug)>
{
    private readonly UtanvegaDbContext _context;

    public CreatePhotographerCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<(Guid Id, string Slug)> Handle(CreatePhotographerCommand request, CancellationToken cancellationToken)
    {
        var photographer = new Photographer
        {
            Name = request.Name,
            Slug = SlugGenerator.Generate(request.Name),
            Website = request.Website,
            Email = request.Email,
            Description = request.Description,
            DescriptionEn = request.DescriptionEn,
        };

        _context.Photographers.Add(photographer);
        await _context.SaveChangesAsync(cancellationToken);

        return (photographer.Id, photographer.Slug);
    }
}

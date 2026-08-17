using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Organizers;

public record CreateOrganizerCommand(
    string Name,
    string? Kennitala,
    string? Phone,
    string? Email,
    string? Website,
    string? Description,
    string? ContactName,
    string? DescriptionEn = null
) : IRequest<(Guid Id, string Slug)>;

public class CreateOrganizerCommandHandler : IRequestHandler<CreateOrganizerCommand, (Guid Id, string Slug)>
{
    private readonly UtanvegaDbContext _context;

    public CreateOrganizerCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<(Guid Id, string Slug)> Handle(CreateOrganizerCommand request, CancellationToken cancellationToken)
    {
        var organizer = new Organizer
        {
            Name = request.Name,
            Slug = SlugGenerator.Generate(request.Name),
            Kennitala = request.Kennitala,
            Phone = request.Phone,
            Email = request.Email,
            Website = request.Website,
            Description = request.Description,
            DescriptionEn = request.DescriptionEn,
            ContactName = request.ContactName,
        };

        _context.Organizers.Add(organizer);
        await _context.SaveChangesAsync(cancellationToken);

        return (organizer.Id, organizer.Slug);
    }
}

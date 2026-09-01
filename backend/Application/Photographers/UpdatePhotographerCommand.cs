using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Photographers;

public record UpdatePhotographerCommand(
    Guid Id,
    string Name,
    string? Website,
    string? Email,
    string? Description,
    string? DescriptionEn = null,
    string? Slug = null,
    List<SocialLink>? SocialLinks = null,
    Dictionary<string, string>? TranslationHashes = null
) : IRequest<bool>;

public class UpdatePhotographerCommandHandler : IRequestHandler<UpdatePhotographerCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public UpdatePhotographerCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdatePhotographerCommand request, CancellationToken cancellationToken)
    {
        var photographer = await _context.Photographers.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (photographer is null) return false;

        photographer.Name = request.Name;
        // A blank or whitespace-only slug means "no change requested" — mirrors
        // UpdateOrganizerCommand so renaming Name alone never regenerates the slug.
        if (!string.IsNullOrWhiteSpace(request.Slug))
            photographer.Slug = request.Slug.Trim();
        photographer.Website = request.Website;
        photographer.Email = request.Email;
        photographer.Description = request.Description;
        photographer.DescriptionEn = request.DescriptionEn;
        photographer.SocialLinks = request.SocialLinks;
        if (request.TranslationHashes != null)
            photographer.TranslationHashes = JsonSerializer.Serialize(request.TranslationHashes);
        photographer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

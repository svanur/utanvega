using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Tags;

public record UpdateTagCommand(
    Guid Id,
    string Name,
    string? Color,
    string? NameEn = null,
    string? Slug = null,
    Dictionary<string, string>? TranslationHashes = null,
    string? ActorUserId = null
) : IRequest<bool>;

public class UpdateTagCommandHandler : IRequestHandler<UpdateTagCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public UpdateTagCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateTagCommand request, CancellationToken cancellationToken)
    {
        var tag = await _context.Tags.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);
        if (tag is null) return false;

        tag.Name = request.Name;
        tag.NameEn = request.NameEn;
        // A blank or whitespace-only slug means "no change requested" — see UpdateTagCommandValidator.
        if (!string.IsNullOrWhiteSpace(request.Slug))
            tag.Slug = request.Slug.Trim();
        tag.Color = request.Color;
        if (request.TranslationHashes != null)
            tag.TranslationHashes = JsonSerializer.Serialize(request.TranslationHashes);

        await _context.SaveChangesWithAuditAsync(request.ActorUserId);
        return true;
    }
}

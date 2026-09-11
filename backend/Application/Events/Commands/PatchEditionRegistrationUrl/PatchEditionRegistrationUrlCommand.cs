using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.PatchEditionRegistrationUrl;

public record PatchEditionRegistrationUrlCommand(Guid Id, string? RegistrationUrl) : IRequest<bool>;

// Narrow, single-field patch for the Race Day page's registration-URL field — see issue #741.
// RaceDayEditionDto never carries Year/TitleEn/Notes/NotesEn/TrailId, so RaceDayPage has no data
// to correctly resend through the generic UpdateEditionCommand PUT; this only ever touches
// RegistrationUrl.
public class PatchEditionRegistrationUrlCommandHandler : IRequestHandler<PatchEditionRegistrationUrlCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public PatchEditionRegistrationUrlCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(PatchEditionRegistrationUrlCommand request, CancellationToken cancellationToken)
    {
        var edition = await _context.EventEditions
            .Include(ed => ed.Event)
            .FirstOrDefaultAsync(ed => ed.Id == request.Id, cancellationToken);

        if (edition == null) return false;

        edition.RegistrationUrl = request.RegistrationUrl;
        edition.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(edition.Event.Slug);
        return true;
    }
}

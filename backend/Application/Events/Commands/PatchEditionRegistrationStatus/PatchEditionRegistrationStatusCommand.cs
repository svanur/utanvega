using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.PatchEditionRegistrationStatus;

public record PatchEditionRegistrationStatusCommand(Guid Id, string RegistrationStatus) : IRequest<bool>;

// Narrow, single-field patch for the Race Day page's registration-status toggle (and its bulk
// open/close-all actions) — see issue #741. RaceDayEditionDto never carries Year/TitleEn/Notes/
// NotesEn/TrailId, so RaceDayPage has no data to correctly resend through the generic
// UpdateEditionCommand PUT; this only ever touches RegistrationStatus.
public class PatchEditionRegistrationStatusCommandHandler : IRequestHandler<PatchEditionRegistrationStatusCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public PatchEditionRegistrationStatusCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(PatchEditionRegistrationStatusCommand request, CancellationToken cancellationToken)
    {
        var edition = await _context.EventEditions
            .Include(ed => ed.Event)
            .FirstOrDefaultAsync(ed => ed.Id == request.Id, cancellationToken);

        if (edition == null) return false;
        if (!Enum.TryParse<RegistrationStatus>(request.RegistrationStatus, ignoreCase: true, out var status)) return false;

        edition.RegistrationStatus = status;
        edition.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(edition.Event.Slug);
        return true;
    }
}

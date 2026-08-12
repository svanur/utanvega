using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.UpdateEdition;

public record UpdateEditionCommand(
    Guid Id,
    int? Year,
    DateOnly? Date,
    DateOnly? EndDate,
    string? Title,
    string? RegistrationUrl,
    string? ResultsUrl,
    string? Notes,
    string RegistrationStatus,
    Guid? TrailId,
    string? TitleEn = null,
    string? NotesEn = null,
    Dictionary<string, string>? TranslationHashes = null,
    string? Status = null,
    string? PhotoGalleryUrl = null
) : IRequest<bool>;

public class UpdateEditionCommandHandler : IRequestHandler<UpdateEditionCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateEditionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(UpdateEditionCommand request, CancellationToken cancellationToken)
    {
        var edition = await _context.EventEditions
            .Include(ed => ed.Event)
            .Include(ed => ed.Races)
            .FirstOrDefaultAsync(ed => ed.Id == request.Id, cancellationToken);

        if (edition == null) return false;

        Enum.TryParse<RegistrationStatus>(request.RegistrationStatus, ignoreCase: true, out var regStatus);

        edition.Year = request.Year;
        edition.Date = request.Date;
        edition.EndDate = request.EndDate;
        edition.Title = request.Title;
        edition.TitleEn = request.TitleEn;
        edition.RegistrationUrl = request.RegistrationUrl;
        edition.ResultsUrl = request.ResultsUrl;
        edition.PhotoGalleryUrl = request.PhotoGalleryUrl;
        edition.Notes = request.Notes;
        edition.NotesEn = request.NotesEn;
        edition.RegistrationStatus = regStatus;
        edition.TrailId = request.TrailId;
        // Status is patch-if-provided, not resend-full-snapshot like the other fields: several
        // existing callers (bulk edition updates, translation-sync) PUT here without knowing about
        // Status, and must not silently reset it back to Active.
        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<EditionStatus>(request.Status, ignoreCase: true, out var status))
        {
            if (status == EditionStatus.Cancelled && edition.Status != EditionStatus.Cancelled)
                // Transitioning into Cancelled always cascades to races + closes registration,
                // regardless of which path (this generic edit, or the dedicated Cancel action)
                // triggered it — overrides the plain RegistrationStatus set just above.
                edition.CancelWithRaces();
            else
                edition.Status = status;
        }
        if (request.TranslationHashes != null)
            edition.TranslationHashes = JsonSerializer.Serialize(request.TranslationHashes);
        edition.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(edition.Event.Slug);
        return true;
    }
}

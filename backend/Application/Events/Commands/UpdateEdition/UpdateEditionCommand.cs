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
    string? Title,
    string? RegistrationUrl,
    string? ResultsUrl,
    string? Notes,
    string RegistrationStatus,
    Guid? TrailId,
    string? TitleEn = null,
    string? NotesEn = null,
    Dictionary<string, string>? TranslationHashes = null
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
            .FirstOrDefaultAsync(ed => ed.Id == request.Id, cancellationToken);

        if (edition == null) return false;

        Enum.TryParse<RegistrationStatus>(request.RegistrationStatus, ignoreCase: true, out var regStatus);

        edition.Year = request.Year;
        edition.Date = request.Date;
        edition.Title = request.Title;
        edition.TitleEn = request.TitleEn;
        edition.RegistrationUrl = request.RegistrationUrl;
        edition.ResultsUrl = request.ResultsUrl;
        edition.Notes = request.Notes;
        edition.NotesEn = request.NotesEn;
        edition.RegistrationStatus = regStatus;
        edition.TrailId = request.TrailId;
        if (request.TranslationHashes != null)
            edition.TranslationHashes = JsonSerializer.Serialize(request.TranslationHashes);
        edition.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(edition.Event.Slug);
        return true;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.CreateEdition;

public record CreateEditionCommand(
    Guid EventId,
    int? Year,
    DateOnly? Date,
    string? Title,
    string? RegistrationUrl,
    string? ResultsUrl,
    string? Notes,
    string RegistrationStatus,
    Guid? TrailId
) : IRequest<Guid>;

public class CreateEditionCommandHandler : IRequestHandler<CreateEditionCommand, Guid>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreateEditionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<Guid> Handle(CreateEditionCommand request, CancellationToken cancellationToken)
    {
        Enum.TryParse<RegistrationStatus>(request.RegistrationStatus, ignoreCase: true, out var regStatus);

        var edition = new EventEdition
        {
            EventId = request.EventId,
            Year = request.Year,
            Date = request.Date,
            Title = request.Title,
            RegistrationUrl = request.RegistrationUrl,
            ResultsUrl = request.ResultsUrl,
            Notes = request.Notes,
            RegistrationStatus = regStatus,
            TrailId = request.TrailId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.EventEditions.Add(edition);
        await _context.SaveChangesAsync(cancellationToken);

        var slug = await _context.Events
            .AsNoTracking()
            .Where(e => e.Id == request.EventId)
            .Select(e => e.Slug)
            .FirstOrDefaultAsync(cancellationToken);

        _cacheInvalidator.InvalidateEvent(slug);

        return edition.Id;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Commands.UpdateCompetition;

public record UpdateCompetitionCommand(
    Guid Id,
    string Name,
    string? Description,
    string? OrganizerName,
    string? OrganizerWebsite,
    string? RegistrationUrl,
    string? AlertMessage,
    string? AlertSeverity,
    Guid? LocationId,
    string Status,
    ScheduleRule? ScheduleRule
) : IRequest<bool>;

public class UpdateCompetitionCommandHandler : IRequestHandler<UpdateCompetitionCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateCompetitionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(UpdateCompetitionCommand request, CancellationToken cancellationToken)
    {
        var competition = await _context.Competitions
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (competition == null) return false;

        Enum.TryParse<CompetitionStatus>(request.Status, true, out var status);

        competition.Name = request.Name;
        competition.Description = request.Description;
        competition.OrganizerName = request.OrganizerName;
        competition.OrganizerWebsite = request.OrganizerWebsite;
        competition.RegistrationUrl = request.RegistrationUrl;
        competition.AlertMessage = request.AlertMessage;
        competition.AlertSeverity = request.AlertSeverity;
        competition.LocationId = request.LocationId;
        competition.Status = status;
        competition.ScheduleRule = request.ScheduleRule;
        competition.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateCompetition(competition.Slug);
        return true;
    }
}

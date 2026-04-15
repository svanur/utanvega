using MediatR;
using Microsoft.EntityFrameworkCore;
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
    Guid? LocationId,
    string Status,
    ScheduleRule? ScheduleRule
) : IRequest<bool>;

public class UpdateCompetitionCommandHandler : IRequestHandler<UpdateCompetitionCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public UpdateCompetitionCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
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
        competition.LocationId = request.LocationId;
        competition.Status = status;
        competition.ScheduleRule = request.ScheduleRule;
        competition.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

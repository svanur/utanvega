using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Commands.CreateCompetition;

public record CreateCompetitionCommand(
    string Name,
    string? Slug,
    string? Description,
    string? OrganizerName,
    string? OrganizerWebsite,
    string? RegistrationUrl,
    Guid? LocationId,
    string Status,
    ScheduleRule? ScheduleRule
) : IRequest<Guid>;

public class CreateCompetitionCommandHandler : IRequestHandler<CreateCompetitionCommand, Guid>
{
    private readonly UtanvegaDbContext _context;

    public CreateCompetitionCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<Guid> Handle(CreateCompetitionCommand request, CancellationToken cancellationToken)
    {
        var slug = request.Slug ?? SlugGenerator.Generate(request.Name);

        Enum.TryParse<CompetitionStatus>(request.Status, true, out var status);

        var competition = new Competition
        {
            Name = request.Name,
            Slug = slug,
            Description = request.Description,
            OrganizerName = request.OrganizerName,
            OrganizerWebsite = request.OrganizerWebsite,
            RegistrationUrl = request.RegistrationUrl,
            LocationId = request.LocationId,
            Status = status,
            ScheduleRule = request.ScheduleRule,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Competitions.Add(competition);
        await _context.SaveChangesAsync(cancellationToken);

        return competition.Id;
    }
}

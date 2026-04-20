using MediatR;
using Utanvega.Backend.Application.Caching;
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
    string? AlertMessage,
    string? AlertSeverity,
    Guid? LocationId,
    string Status,
    ScheduleRule? ScheduleRule
) : IRequest<Guid>;

public class CreateCompetitionCommandHandler : IRequestHandler<CreateCompetitionCommand, Guid>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreateCompetitionCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
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
            AlertMessage = request.AlertMessage,
            AlertSeverity = request.AlertSeverity,
            LocationId = request.LocationId,
            Status = status,
            ScheduleRule = request.ScheduleRule,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Competitions.Add(competition);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateCompetition(slug);

        return competition.Id;
    }
}

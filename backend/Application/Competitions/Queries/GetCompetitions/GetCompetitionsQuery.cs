using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Queries.GetCompetitions;

public record GetCompetitionsQuery(bool IncludeRetired = false) : IRequest<List<CompetitionDto>>;

public class GetCompetitionsQueryHandler : IRequestHandler<GetCompetitionsQuery, List<CompetitionDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetCompetitionsQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<List<CompetitionDto>> Handle(GetCompetitionsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Competitions
            .AsNoTracking()
            .Include(c => c.Location)
            .Include(c => c.Races)
            .AsQueryable();

        if (!request.IncludeRetired)
            query = query.Where(c => c.Status != Core.Entities.CompetitionStatus.Retired);

        var competitions = await query
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return competitions.Select(c =>
        {
            var nextDate = c.ScheduleRule != null
                ? _scheduleEngine.GetNextOccurrence(c.ScheduleRule, today)
                : null;
            var daysUntil = nextDate.HasValue
                ? nextDate.Value.DayNumber - today.DayNumber
                : (int?)null;

            return new CompetitionDto(
                c.Id,
                c.Name,
                c.Slug,
                c.Description,
                c.OrganizerName,
                c.OrganizerWebsite,
                c.RegistrationUrl,
                c.LocationId,
                c.Location?.Name,
                c.Status.ToString(),
                c.ScheduleRule,
                nextDate,
                daysUntil,
                c.Races.Count,
                c.CreatedAt,
                c.UpdatedAt
            );
        }).ToList();
    }
}

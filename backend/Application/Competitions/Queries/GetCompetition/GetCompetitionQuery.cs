using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Competitions.Queries.GetCompetitions;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Competitions.Queries.GetCompetition;

public record GetCompetitionQuery(string Slug) : IRequest<CompetitionDetailDto?>;

public record CompetitionDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? OrganizerName,
    string? OrganizerWebsite,
    string? RegistrationUrl,
    Guid? LocationId,
    string? LocationName,
    string Status,
    Core.Entities.ScheduleRule? ScheduleRule,
    DateOnly? NextDate,
    int? DaysUntil,
    List<DateOnly> UpcomingDates,
    List<RaceDto> Races,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public class GetCompetitionQueryHandler : IRequestHandler<GetCompetitionQuery, CompetitionDetailDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetCompetitionQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<CompetitionDetailDto?> Handle(GetCompetitionQuery request, CancellationToken cancellationToken)
    {
        var competition = await _context.Competitions
            .AsNoTracking()
            .Include(c => c.Location)
            .Include(c => c.Races)
                .ThenInclude(r => r.Trail)
            .FirstOrDefaultAsync(c => c.Slug == request.Slug, cancellationToken);

        if (competition == null) return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var nextDate = competition.ScheduleRule != null
            ? _scheduleEngine.GetNextOccurrence(competition.ScheduleRule, today)
            : null;
        var daysUntil = nextDate.HasValue
            ? nextDate.Value.DayNumber - today.DayNumber
            : (int?)null;

        var upcomingDates = competition.ScheduleRule != null
            ? _scheduleEngine.GetOccurrencesInRange(competition.ScheduleRule, today, today.AddMonths(12))
            : new List<DateOnly>();

        var races = competition.Races
            .OrderBy(r => r.SortOrder)
            .Select(r => new RaceDto(
                r.Id,
                r.CompetitionId,
                r.TrailId,
                r.Trail?.Name,
                r.Trail?.Slug,
                r.Name,
                r.DistanceLabel,
                r.CutoffMinutes,
                r.Description,
                r.Status.ToString(),
                r.SortOrder,
                r.Trail?.Length,
                r.Trail?.ElevationGain
            ))
            .ToList();

        return new CompetitionDetailDto(
            competition.Id,
            competition.Name,
            competition.Slug,
            competition.Description,
            competition.OrganizerName,
            competition.OrganizerWebsite,
            competition.RegistrationUrl,
            competition.LocationId,
            competition.Location?.Name,
            competition.Status.ToString(),
            competition.ScheduleRule,
            nextDate,
            daysUntil,
            upcomingDates,
            races,
            competition.CreatedAt,
            competition.UpdatedAt
        );
    }
}

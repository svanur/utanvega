using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;

public record GenerateEditionsForSeasonCommand(
    Guid EventId,
    DateOnly From,
    DateOnly To,
    Guid? TrailId = null,
    string? RegistrationUrl = null
) : IRequest<List<Guid>>;

public class GenerateEditionsForSeasonCommandHandler : IRequestHandler<GenerateEditionsForSeasonCommand, List<Guid>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;
    private readonly ICacheInvalidator _cacheInvalidator;

    public GenerateEditionsForSeasonCommandHandler(
        UtanvegaDbContext context,
        IScheduleRuleEngine scheduleEngine,
        ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<List<Guid>> Handle(GenerateEditionsForSeasonCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (ev?.ScheduleRule == null)
            return [];

        var dates = _scheduleEngine.GetOccurrencesInRange(ev.ScheduleRule, request.From, request.To);

        // Load existing editions in the date range
        var existingEditions = await _context.EventEditions
            .Where(ed => ed.EventId == request.EventId && ed.Date != null)
            .ToListAsync(cancellationToken);

        var existingDateSet = existingEditions
            .Where(ed => ed.Date.HasValue)
            .Select(ed => ed.Date!.Value)
            .ToHashSet();

        var newDates = dates.Where(d => !existingDateSet.Contains(d)).ToList();

        // Create new editions for dates that don't exist yet
        var editions = newDates.Select((date, index) => new EventEdition
        {
            EventId = request.EventId,
            Date = date,
            Year = date.Year,
            Title = $"Hlaup {index + 1}",
            TrailId = request.TrailId,
            RegistrationUrl = request.RegistrationUrl,
            RegistrationStatus = RegistrationStatus.NotStarted,
            CreatedAt = DateTime.UtcNow,
        }).ToList();

        _context.EventEditions.AddRange(editions);

        // Apply defaults to existing editions that are missing them
        if (request.TrailId.HasValue || !string.IsNullOrWhiteSpace(request.RegistrationUrl))
        {
            var editionsInRange = existingEditions
                .Where(ed => ed.Date.HasValue && ed.Date.Value >= request.From && ed.Date.Value <= request.To);

            foreach (var ed in editionsInRange)
            {
                if (request.TrailId.HasValue && ed.TrailId == null)
                    ed.TrailId = request.TrailId;
                if (!string.IsNullOrWhiteSpace(request.RegistrationUrl) && string.IsNullOrWhiteSpace(ed.RegistrationUrl))
                    ed.RegistrationUrl = request.RegistrationUrl;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(ev.Slug);

        return editions.Select(e => e.Id).ToList();
    }
}

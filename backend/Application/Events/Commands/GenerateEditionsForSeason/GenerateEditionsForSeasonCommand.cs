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

        // Skip dates that already have an edition
        var existingDates = await _context.EventEditions
            .Where(ed => ed.EventId == request.EventId && ed.Date != null)
            .Select(ed => ed.Date!.Value)
            .ToListAsync(cancellationToken);

        var existingDateSet = existingDates.ToHashSet();
        var newDates = dates.Where(d => !existingDateSet.Contains(d)).ToList();

        var editions = newDates.Select((date, index) => new EventEdition
        {
            EventId = request.EventId,
            Date = date,
            Year = date.Year,
            Title = $"Round {index + 1}",
            TrailId = request.TrailId,
            RegistrationUrl = request.RegistrationUrl,
            RegistrationStatus = RegistrationStatus.NotStarted,
            CreatedAt = DateTime.UtcNow,
        }).ToList();

        _context.EventEditions.AddRange(editions);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(ev.Slug);

        return editions.Select(e => e.Id).ToList();
    }
}

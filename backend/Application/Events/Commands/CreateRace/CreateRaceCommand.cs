using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.CreateRace;

public record CreateRaceCommand(
    Guid EventEditionId,
    Guid? TrailId,
    string Name,
    string? DistanceLabel,
    int? CutoffMinutes,
    string? Description,
    string Status,
    int SortOrder,
    string TicketStatus,
    string ResultType,
    int? MaxParticipants,
    int? ItraPoints,
    string? CertifiedBy,
    decimal PrizeMoney,
    string? ChampionshipCategory,
    DateOnly? DateOfRace,
    TimeOnly? StartTime,
    string? NameEn = null,
    string? DescriptionEn = null,
    string? CertifiedByEn = null,
    string? ChampionshipCategoryEn = null,
    string? ActivityType = null,
    string? DistanceLabelEn = null
) : IRequest<Guid>;

public class CreateRaceCommandHandler : IRequestHandler<CreateRaceCommand, Guid>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreateRaceCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<Guid> Handle(CreateRaceCommand request, CancellationToken cancellationToken)
    {
        Enum.TryParse<RaceStatus>(request.Status, ignoreCase: true, out var status);
        Enum.TryParse<TicketStatus>(request.TicketStatus, ignoreCase: true, out var ticketStatus);
        Enum.TryParse<ResultType>(request.ResultType, ignoreCase: true, out var resultType);
        var activityType = Enum.TryParse<ActivityType>(request.ActivityType, ignoreCase: true, out var at) ? at : (ActivityType?)null;

        var parentEditionStatus = await _context.EventEditions
            .AsNoTracking()
            .Where(ed => ed.Id == request.EventEditionId)
            .Select(ed => ed.Status)
            .FirstOrDefaultAsync(cancellationToken);

        // A race can't be attached as Active under an edition that's already Completed — force it
        // to match, overriding whatever the client sent, the same way an edition's own
        // CompleteWithRaces() would have completed it had it existed before the edition was.
        if (parentEditionStatus == EditionStatus.Completed)
        {
            status = RaceStatus.Completed;
            ticketStatus = TicketStatus.Closed;
        }

        var race = new Race
        {
            EventEditionId = request.EventEditionId,
            TrailId = request.TrailId,
            Name = request.Name,
            NameEn = request.NameEn,
            DistanceLabel = request.DistanceLabel,
            DistanceLabelEn = request.DistanceLabelEn,
            CutoffMinutes = request.CutoffMinutes,
            Description = request.Description,
            DescriptionEn = request.DescriptionEn,
            Status = status,
            SortOrder = request.SortOrder,
            TicketStatus = ticketStatus,
            ResultType = resultType,
            MaxParticipants = request.MaxParticipants,
            ItraPoints = request.ItraPoints,
            CertifiedBy = request.CertifiedBy,
            CertifiedByEn = request.CertifiedByEn,
            PrizeMoney = request.PrizeMoney,
            ChampionshipCategory = request.ChampionshipCategory,
            ChampionshipCategoryEn = request.ChampionshipCategoryEn,
            DateOfRace = request.DateOfRace,
            StartTime = request.StartTime,
            ActivityType = activityType,
        };

        _context.Races.Add(race);
        await _context.SaveChangesAsync(cancellationToken);

        var slug = await _context.EventEditions
            .AsNoTracking()
            .Where(ed => ed.Id == request.EventEditionId)
            .Select(ed => ed.Event.Slug)
            .FirstOrDefaultAsync(cancellationToken);

        _cacheInvalidator.InvalidateEvent(slug);

        return race.Id;
    }
}

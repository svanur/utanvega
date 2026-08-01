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
    string? ChampionshipCategoryEn = null
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

        var race = new Race
        {
            EventEditionId = request.EventEditionId,
            TrailId = request.TrailId,
            Name = request.Name,
            NameEn = request.NameEn,
            DistanceLabel = request.DistanceLabel,
            CutoffMinutes = request.CutoffMinutes,
            Description = request.Description,
            DescriptionEn = request.DescriptionEn,
            Status = status,
            SortOrder = request.SortOrder,
            TicketStatus = ticketStatus,
            MaxParticipants = request.MaxParticipants,
            ItraPoints = request.ItraPoints,
            CertifiedBy = request.CertifiedBy,
            CertifiedByEn = request.CertifiedByEn,
            PrizeMoney = request.PrizeMoney,
            ChampionshipCategory = request.ChampionshipCategory,
            ChampionshipCategoryEn = request.ChampionshipCategoryEn,
            DateOfRace = request.DateOfRace,
            StartTime = request.StartTime,
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

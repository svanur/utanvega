using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetPrevRaceDay;

public record GetPrevRaceDayQuery(DateOnly Before) : IRequest<DateOnly?>;

public class GetPrevRaceDayQueryHandler : IRequestHandler<GetPrevRaceDayQuery, DateOnly?>
{
    private readonly UtanvegaDbContext _context;

    public GetPrevRaceDayQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<DateOnly?> Handle(GetPrevRaceDayQuery request, CancellationToken cancellationToken)
    {
        return await _context.EventEditions
            .AsNoTracking()
            .Include(ed => ed.Event)
            .Where(ed =>
                ed.Date.HasValue &&
                ed.Date < request.Before &&
                ed.Event.Status != EventStatus.Hidden)
            .OrderByDescending(ed => ed.Date)
            .Select(ed => ed.Date)
            .FirstOrDefaultAsync(cancellationToken);
    }
}

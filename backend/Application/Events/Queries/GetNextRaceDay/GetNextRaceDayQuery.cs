using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetNextRaceDay;

public record GetNextRaceDayQuery(DateOnly After) : IRequest<DateOnly?>;

public class GetNextRaceDayQueryHandler : IRequestHandler<GetNextRaceDayQuery, DateOnly?>
{
    private readonly UtanvegaDbContext _context;

    public GetNextRaceDayQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<DateOnly?> Handle(GetNextRaceDayQuery request, CancellationToken cancellationToken)
    {
        return await _context.EventEditions
            .AsNoTracking()
            .Include(ed => ed.Event)
            .Where(ed =>
                ed.Date.HasValue &&
                ed.Date > request.After &&
                ed.Event.Status != EventStatus.Hidden)
            .OrderBy(ed => ed.Date)
            .Select(ed => ed.Date)
            .FirstOrDefaultAsync(cancellationToken);
    }
}

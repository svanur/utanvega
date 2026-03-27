using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.History.Queries.GetChangeLogs;

public record ChangeLogDto(
    Guid Id,
    string EntityName,
    string EntityId,
    string Action,
    string? Description,
    string? Changes,
    string? UserId,
    DateTime TimestampUtc
);

public record GetChangeLogsQuery(
    string? EntityName = null,
    string? EntityId = null,
    int Limit = 50
) : IRequest<List<ChangeLogDto>>;

public class GetChangeLogsQueryHandler : IRequestHandler<GetChangeLogsQuery, List<ChangeLogDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetChangeLogsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<ChangeLogDto>> Handle(GetChangeLogsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.ChangeLogs.AsNoTracking();

        if (!string.IsNullOrEmpty(request.EntityName))
            query = query.Where(l => l.EntityName == request.EntityName);

        if (!string.IsNullOrEmpty(request.EntityId))
            query = query.Where(l => l.EntityId == request.EntityId);

        return await query
            .OrderByDescending(l => l.TimestampUtc)
            .Take(request.Limit)
            .Select(l => new ChangeLogDto(
                l.Id,
                l.EntityName,
                l.EntityId,
                l.Action,
                l.Description,
                l.Changes,
                l.UserId,
                l.TimestampUtc
            ))
            .ToListAsync(cancellationToken);
    }
}

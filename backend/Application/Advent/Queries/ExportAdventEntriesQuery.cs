using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Advent.Queries;

/// <summary>
/// The admin-only export handed to Sportís as a plain <c>.txt</c> file (#1875) — every distinct
/// email with at least one <see cref="Core.Entities.AdventEntry"/> row, of either Source.
/// </summary>
public sealed record ExportAdventEntriesQuery : IRequest<IReadOnlyList<string>>;

public sealed class ExportAdventEntriesQueryHandler(UtanvegaDbContext db)
    : IRequestHandler<ExportAdventEntriesQuery, IReadOnlyList<string>>
{
    public async Task<IReadOnlyList<string>> Handle(ExportAdventEntriesQuery request, CancellationToken cancellationToken)
    {
        return await db.AdventEntries
            .AsNoTracking()
            .Select(e => e.Email)
            .Distinct()
            .OrderBy(e => e)
            .ToListAsync(cancellationToken);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Advent.Commands;

/// <summary>Why a <see cref="GrantAdventShareBonusCommand"/> did or didn't grant a bonus ticket.</summary>
public enum GrantAdventShareBonusOutcome
{
    /// <summary>No prior <see cref="AdventEntrySource.Answer"/> entry for this email/day — rejected.</summary>
    NoPriorAnswer,

    /// <summary>Granted — either newly, or idempotently (the bonus was already held).</summary>
    Granted,
}

public sealed record GrantAdventShareBonusCommand(int Day, string Email) : IRequest<GrantAdventShareBonusOutcome>;

/// <summary>
/// Trust-based share bonus (#1875): no verification a share actually happened, by design — the
/// only gate is that the email already holds a real <see cref="AdventEntrySource.Answer"/> ticket
/// for that day, so the bonus can never be earned on its own. Repeat calls are idempotent.
/// </summary>
public sealed class GrantAdventShareBonusCommandHandler(UtanvegaDbContext db)
    : IRequestHandler<GrantAdventShareBonusCommand, GrantAdventShareBonusOutcome>
{
    public async Task<GrantAdventShareBonusOutcome> Handle(GrantAdventShareBonusCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = AdventEmailNormalizer.Normalize(request.Email);

        var hasAnswer = await db.AdventEntries.AsNoTracking().AnyAsync(
            e => e.Email == normalizedEmail && e.Day == request.Day && e.Source == AdventEntrySource.Answer,
            cancellationToken);

        if (!hasAnswer)
            return GrantAdventShareBonusOutcome.NoPriorAnswer;

        var alreadyShared = await db.AdventEntries.AsNoTracking().AnyAsync(
            e => e.Email == normalizedEmail && e.Day == request.Day && e.Source == AdventEntrySource.Share,
            cancellationToken);

        if (!alreadyShared)
        {
            db.AdventEntries.Add(new AdventEntry
            {
                Id = Guid.NewGuid(),
                Email = normalizedEmail,
                Day = request.Day,
                Source = AdventEntrySource.Share,
                CreatedAt = DateTime.UtcNow,
            });

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
            {
                // Concurrent duplicate share for this email/day — the row exists either way,
                // same idempotent-success shape as SubmitAdventAnswerCommandHandler.
            }
        }

        return GrantAdventShareBonusOutcome.Granted;
    }
}

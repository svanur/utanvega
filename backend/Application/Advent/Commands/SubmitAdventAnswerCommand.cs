using MediatR;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Newsletter;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Advent.Commands;

/// <summary>Why a <see cref="SubmitAdventAnswerCommand"/> did or didn't win a ticket.</summary>
public enum SubmitAdventAnswerOutcome
{
    /// <summary>The day is outside 1-24 or not yet unlocked — rejected before checking the answer.</summary>
    DayLocked,

    /// <summary><paramref name="SelectedIndex"/> didn't match. No row written, MailerLite not called.</summary>
    Incorrect,

    /// <summary>
    /// Correct — either a brand-new ticket was written this call, or the caller already held one
    /// for this day (idempotent repeat win). Either way MailerLite was called.
    /// </summary>
    Correct,
}

public sealed record SubmitAdventAnswerCommand(int Day, int SelectedIndex, string Email)
    : IRequest<SubmitAdventAnswerOutcome>;

/// <summary>
/// Validates the day is unlocked and computes correctness server-side — the correct index never
/// reaches the caller in either outcome. A correct answer is a mandatory-signup event: it upserts
/// an <see cref="AdventEntry"/> (idempotent — a repeat win is a no-op, not an error) and always
/// calls <see cref="MailerLiteClientProvider.SubscribeAsync"/>, even on the idempotent repeat path,
/// matching the rules text ("getting a ticket subscribes you") rather than only the first win.
/// A MailerLite failure is logged, never thrown — it must not fail the ticket (#1875 AC).
/// </summary>
public sealed class SubmitAdventAnswerCommandHandler(
    UtanvegaDbContext db,
    TimeProvider timeProvider,
    MailerLiteClientProvider mailerLite,
    ILogger<SubmitAdventAnswerCommandHandler> logger
) : IRequestHandler<SubmitAdventAnswerCommand, SubmitAdventAnswerOutcome>
{
    public async Task<SubmitAdventAnswerOutcome> Handle(SubmitAdventAnswerCommand request, CancellationToken cancellationToken)
    {
        if (!AdventCalendar.IsDayUnlocked(request.Day, timeProvider))
            return SubmitAdventAnswerOutcome.DayLocked;

        var question = AdventQuestions.ForDay(request.Day);
        if (question is null)
            return SubmitAdventAnswerOutcome.DayLocked;

        if (request.SelectedIndex != question.CorrectIndex)
            return SubmitAdventAnswerOutcome.Incorrect;

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var alreadyWon = await db.AdventEntries.AsNoTracking().AnyAsync(
            e => e.Email == normalizedEmail && e.Day == request.Day && e.Source == AdventEntrySource.Answer,
            cancellationToken);

        if (!alreadyWon)
        {
            db.AdventEntries.Add(new AdventEntry
            {
                Id = Guid.NewGuid(),
                Email = normalizedEmail,
                Day = request.Day,
                Source = AdventEntrySource.Answer,
                CreatedAt = timeProvider.GetUtcNow().UtcDateTime,
            });

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
            {
                // Concurrent duplicate submission for this email/day raced us to the unique index
                // — the row exists either way, so this is the same idempotent success as the
                // alreadyWon branch above (#1875 AC: "no second row created, no error surfaced").
            }
        }

        try
        {
            var result = await mailerLite.SubscribeAsync(normalizedEmail, cancellationToken);
            if (result.Outcome == MailerLiteSubscribeOutcome.Failed)
                logger.LogError("Failed to subscribe advent entrant to MailerLite: {Detail}", result.ErrorDetail);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to subscribe advent entrant to MailerLite");
        }

        return SubmitAdventAnswerOutcome.Correct;
    }
}

namespace Utanvega.Backend.Core.Entities;

/// <summary>
/// How an <see cref="AdventEntry"/> ticket was earned — a correct quiz answer, or the bonus ticket
/// granted for sharing the game (see #1875). An email can hold at most one of each per
/// <see cref="AdventEntry.Day"/>, enforced by the unique index on (Email, Day, Source).
/// </summary>
public enum AdventEntrySource
{
    Answer,
    Share,
}

/// <summary>
/// One ticket in the "Jóladagatal Hlaupadagskra.is 2026" advent quiz (#1875) — either a correct
/// answer to that day's question, or the share bonus for that day. Rows are never updated after
/// insert; a repeat win/share for the same (Email, Day, Source) is idempotent at the handler level
/// (see <c>SubmitAdventAnswerCommand</c>/<c>GrantAdventShareBonusCommand</c>), not expressed here.
/// </summary>
public class AdventEntry
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public int Day { get; set; }
    public AdventEntrySource Source { get; set; }
    public DateTime CreatedAt { get; set; }
}

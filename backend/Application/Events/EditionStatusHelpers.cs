using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Events;

public static class EditionStatusHelpers
{
    // All-races-cancelled only implies effective cancellation for non-terminal edition statuses.
    // Completed means the edition already ran to conclusion — CompleteWithRaces() leaves races that
    // were Cancelled beforehand as Cancelled, so "every race is Cancelled" is reachable on a Completed
    // edition and must not retroactively read as cancelled.
    public static bool ComputeEffectiveCancelled(EditionStatus status, IReadOnlyCollection<RaceStatus> raceStatuses) =>
        status == EditionStatus.Cancelled ||
        (status != EditionStatus.Completed && raceStatuses.Count > 0 && raceStatuses.All(s => s == RaceStatus.Cancelled));

    // For multi-day events, EndDate is what determines whether the whole run is over; single-day
    // editions fall back to Date. Shared by CreateEditionCommand and GenerateEditionsForSeasonCommand
    // so both apply "already past on creation" the same way.
    public static DateOnly? EffectiveDate(DateOnly? date, DateOnly? endDate) => endDate ?? date;

    // A null date (edition with no date set yet) is never "past" — there's nothing to compare.
    public static bool IsPast(DateOnly? date, DateOnly today) => date.HasValue && date.Value < today;
}

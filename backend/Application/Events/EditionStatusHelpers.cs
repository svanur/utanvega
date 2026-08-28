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
}

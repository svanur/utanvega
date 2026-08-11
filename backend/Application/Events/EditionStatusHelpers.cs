using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Events;

public static class EditionStatusHelpers
{
    public static bool ComputeEffectiveCancelled(EditionStatus status, IReadOnlyCollection<RaceStatus> raceStatuses) =>
        status == EditionStatus.Cancelled ||
        (raceStatuses.Count > 0 && raceStatuses.All(s => s == RaceStatus.Cancelled));
}

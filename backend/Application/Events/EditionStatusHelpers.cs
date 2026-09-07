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

    // RegistrationStatus is stored (set by hand via the admin dropdown, or forced by
    // CancelWithRaces()/CompleteWithRaces()) but can go stale the moment registration actually
    // opens or closes. When both RegistrationOpens and RegistrationCloses are set, derive the
    // live value from "now" instead of trusting whatever was last saved — same "derive live,
    // don't store and let it go stale" precedent as ComputeEffectiveCancelled above.
    public static RegistrationStatus ComputeEffectiveRegistrationStatus(
        EditionStatus status,
        RegistrationStatus storedStatus,
        DateTime? registrationOpens,
        DateTime? registrationCloses,
        DateTime now)
    {
        // Cancelled/Completed are terminal — CancelWithRaces()/CompleteWithRaces() already forced
        // RegistrationStatus to Closed (unless NotRequired) as part of that cascade, and that must
        // remain the source of truth regardless of what the opens/closes window would compute.
        if (status == EditionStatus.Cancelled || status == EditionStatus.Completed)
            return storedStatus;

        // NotRequired is a deliberate override that has nothing to do with timing — e.g. a free,
        // no-signup fun run — and must not be clobbered by a live computation.
        if (storedStatus == RegistrationStatus.NotRequired)
            return RegistrationStatus.NotRequired;

        if (registrationOpens.HasValue && registrationCloses.HasValue)
        {
            if (now < registrationOpens.Value) return RegistrationStatus.NotStarted;
            if (now > registrationCloses.Value) return RegistrationStatus.Closed;
            return RegistrationStatus.Open;
        }

        // No window to compute from — today's behaviour, unchanged.
        return storedStatus;
    }

    // Npgsql requires Kind=Utc for a "timestamp with time zone" column. Admin-submitted
    // RegistrationOpens/Closes values arrive via System.Text.Json with Kind=Unspecified (no
    // offset in the payload) — relabel rather than convert, since the admin's date picker has
    // no timezone concept of its own to convert from.
    public static DateTime? AsUtc(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;
}

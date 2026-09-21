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
            // RegistrationCloses is a date-only value under the hood (the admin's DatePicker only
            // captures a calendar day, stored as midnight UTC via AsUtc) — treat the closes-date
            // itself as still open through its full 24 hours, i.e. compare against the start of
            // the *next* day, not the instant stored. Otherwise the entire last intended day of
            // registration would read as Closed from 00:00 UTC, same class of bug Date/EndDate's
            // date-granularity IsPast already avoids for this same entity.
            if (now >= registrationCloses.Value.Date.AddDays(1)) return RegistrationStatus.Closed;
            return RegistrationStatus.Open;
        }

        // No window to compute from — today's behaviour, unchanged.
        return storedStatus;
    }

    // TicketStatus is stored per-race (set by hand via the admin dropdown, or forced by
    // CancelWithRaces()/CompleteWithRaces()/CreateRaceCommand) but the same "derive live, don't
    // store and let it go stale" problem as ComputeEffectiveRegistrationStatus applies here too:
    // a race created while its edition's registration hasn't opened yet defaults to Available
    // and stays that way until someone remembers to edit it by hand.
    public static TicketStatus ComputeEffectiveTicketStatus(
        RaceStatus raceStatus,
        TicketStatus storedTicketStatus,
        RegistrationStatus effectiveEditionRegistrationStatus)
    {
        // Cancelled/Completed are terminal for the race itself — CancelWithRaces()/
        // CompleteWithRaces() already forced TicketStatus to Closed as part of that cascade, and
        // that must remain the source of truth regardless of the edition's registration window.
        if (raceStatus == RaceStatus.Cancelled || raceStatus == RaceStatus.Completed)
            return storedTicketStatus;

        // SoldOut/AlmostSoldOut are deliberate manual overrides that have nothing to do with the
        // registration window timing and must not be clobbered by a live computation.
        if (storedTicketStatus == TicketStatus.SoldOut || storedTicketStatus == TicketStatus.AlmostSoldOut)
            return storedTicketStatus;

        return effectiveEditionRegistrationStatus switch
        {
            RegistrationStatus.NotStarted => TicketStatus.NotStarted,
            RegistrationStatus.Open => TicketStatus.Available,
            RegistrationStatus.Closed => TicketStatus.Closed,
            RegistrationStatus.NotRequired => TicketStatus.Free,
            _ => storedTicketStatus,
        };
    }

    // Npgsql requires Kind=Utc for a "timestamp with time zone" column. Admin-submitted
    // RegistrationOpens/Closes values arrive via System.Text.Json with Kind=Unspecified (no
    // offset in the payload) — relabel rather than convert, since the admin's date picker has
    // no timezone concept of its own to convert from.
    public static DateTime? AsUtc(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;
}

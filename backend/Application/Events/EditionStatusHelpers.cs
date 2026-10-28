using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

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
        // no-signup fun run — and must not be clobbered by a live computation. Invitational is the
        // same kind of override — entry by selection, not a public registration window — e.g. the
        // Backyard Ultra World Championship.
        if (storedStatus == RegistrationStatus.NotRequired)
            return RegistrationStatus.NotRequired;

        if (storedStatus == RegistrationStatus.Invitational)
            return RegistrationStatus.Invitational;

        if (registrationOpens.HasValue && registrationCloses.HasValue)
        {
            if (now < registrationOpens.Value) return RegistrationStatus.NotStarted;
            // RegistrationCloses now carries real time-of-day precision (the admin's
            // DateTimePicker captures the full instant, not just a calendar day), so compare
            // directly against the stored value — no more rolling forward to the start of the
            // next day (#1071).
            if (now >= registrationCloses.Value) return RegistrationStatus.Closed;
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
            RegistrationStatus.Invitational => TicketStatus.Invitational,
            _ => storedTicketStatus,
        };
    }

    // Single source of truth for "which of an edition's races count toward its derived Date/EndDate"
    // (#1292) — previously each of GetEventsQuery/GetAllEventDetailsQuery/GetEventQuery/
    // UpdateEditionCommand kept its own copy of this same filter. A Cancelled race's date must not
    // skew the derived min/max (#1261), so it's excluded here exactly like every caller already
    // excluded it before this helper existed.
    public static List<DateOnly> SeriesRaceDates(IEnumerable<Race> races) =>
        races.Where(r => r.DateOfRace.HasValue && r.Status != RaceStatus.Cancelled)
            .Select(r => r.DateOfRace!.Value)
            .ToList();

    // Single source of truth for "does this edition's Date/EndDate come from its races rather than
    // its stored columns" — shared by both the read-side derivation (ComputeEffectiveEditionDates
    // below) and the write-side guard (UpdateEditionCommandHandler) that must stop persisting
    // whatever a client sends for Date/EndDate once this is true, or a client re-submitting an
    // already-derived snapshot (e.g. the admin dialog's own disabled-but-still-serialized form
    // fields) would silently overwrite the stored columns with that snapshot — corrupting the very
    // "fall back to stored values" escape hatch this feature relies on for the next read where the
    // race set has since changed. Keeping both sides behind one predicate is what keeps them from
    // drifting apart the way the two would if each re-implemented this condition separately.
    public static bool IsEditionDateDerivedFromRaces(EventType eventType, IReadOnlyCollection<DateOnly> raceDates) =>
        eventType == EventType.Series && raceDates.Count > 0;

    // A Series edition's Date/EndDate are stored columns with nothing keeping them in sync with its
    // races' DateOfRace values as races are added/edited/removed. Rather than recompute-and-persist
    // on every race write (same tradeoff ComputeEffectiveRegistrationStatus already made in favour
    // of deriving live from RegistrationOpens/Closes), derive the edition's display range live from
    // its dated races: min becomes Date, max becomes EndDate. Only applies to Series editions that
    // actually have at least one dated race — a brand-new Series edition with no races yet, and
    // every non-Series edition, fall back to the raw stored values unchanged.
    public static (DateOnly? Date, DateOnly? EndDate) ComputeEffectiveEditionDates(
        EventType eventType,
        DateOnly? storedDate,
        DateOnly? storedEndDate,
        IReadOnlyCollection<DateOnly> raceDates)
    {
        if (!IsEditionDateDerivedFromRaces(eventType, raceDates))
            return (storedDate, storedEndDate);

        return (raceDates.Min(), raceDates.Max());
    }

    // Single source of truth for "which upcoming edition should an event surface as its next
    // date" — shared by GetEventQuery and GetEventsQuery, which previously each kept their own
    // copy (#1320). Both copies only ever compared an edition's *start* Date against today, so a
    // Series edition whose first race had already passed while a later race in that same edition
    // (reflected in the derived EffEndDate from ComputeEffectiveEditionDates above) was still
    // upcoming would wrongly read as "already over" and fall through to a stale ScheduleRule
    // occurrence instead of the real remaining race.
    //
    // Fixing the comparison to (EndDate ?? Date) >= today is the core of #1320, but a naive version
    // of that fix would also change *which value* every edition reports: a perfectly ordinary
    // future multi-day edition (Date and EndDate both still ahead) would start reporting its last
    // day instead of its first, a regression nothing asked for. So the two concerns are split: the
    // (EndDate ?? Date) boundary only decides whether an edition still *qualifies* at all (not yet
    // fully over); the value actually returned for a qualifying edition is its own Date while that
    // is still in the future, and only falls back to EndDate once the edition has already started
    // (Date has passed) but hasn't finished — i.e. exactly the "later race still upcoming" case.
    public static DateOnly? ResolveNextEditionDate(
        IEnumerable<EventEdition> editions,
        DateOnly today,
        Func<EventEdition?, DateOnly?> effDate,
        Func<EventEdition?, DateOnly?> effEndDate,
        ScheduleRule? scheduleRule,
        IScheduleRuleEngine scheduleEngine)
    {
        DateOnly? Candidate(EventEdition ed)
        {
            var date = effDate(ed);
            if (!date.HasValue)
                return null; // no start date at all — every other edition-scoped field
                             // (ongoingEdition/relevantEdition in GetEventQuery/GetEventsQuery)
                             // treats this edition as nonexistent, so NextEditionDate must too (#1327)

            var endDate = effEndDate(ed);
            var boundary = endDate ?? date;
            if (boundary.Value < today)
                return null; // already fully over — doesn't qualify as "next"

            // Hasn't started yet — surface its own start date, unchanged from the pre-#1320
            // behaviour. Already underway — surface the remaining boundary (EndDate) instead of
            // a start date that has already passed.
            return date.Value >= today ? date : endDate;
        }

        var nextEditionDate = editions
            .Select(Candidate)
            .Where(d => d.HasValue)
            .OrderBy(d => d)
            .FirstOrDefault();

        if (nextEditionDate.HasValue)
            return nextEditionDate;

        return scheduleRule != null
            ? scheduleEngine.GetNextOccurrence(scheduleRule, today)
            : null;
    }

    // Npgsql requires Kind=Utc for a "timestamp with time zone" column. Admin-submitted
    // RegistrationOpens/Closes values arrive via System.Text.Json with Kind=Unspecified (no
    // offset in the payload) — relabel rather than convert, since the admin's date*time* picker
    // (#1071) has no timezone concept of its own to convert from. The same relabel-not-convert
    // contract applies symmetrically on read: EventDetailPage.tsx parses the resulting Kind=Utc
    // (Z-suffixed) value with dayjs.utc(...), not plain dayjs(...), so the displayed time is the
    // literal stored digits rather than a real UTC instant converted to the admin's own timezone.
    public static DateTime? AsUtc(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;
}

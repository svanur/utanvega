import type { EventSummary } from '../hooks/useEvents';
import { getWeekRange } from './eventUtils';

export type RaceDistanceBucket = '<10' | '10-21' | '21-42' | '42-100' | '100+';

export interface EventFilters {
    activityTypes: string[];
    months: number[];
    locations: string[];
    itraAny: boolean;
    itraPoints: number[];
    certifications: string[];
    championships: string[];
    weekendOnly: boolean;
    thisWeekOnly: boolean;
    nextWeekOnly: boolean;
    mountainRaceOnly: boolean;
    favoritesOnly: boolean;
    distanceBuckets: RaceDistanceBucket[];
}

// #1026: used by RacesPage's URL→state hydration effect to bail out of `setFilters` when the
// freshly-parsed-from-URL filters are value-equal to what's already in state, so re-running that
// effect on every `searchParams` change (not just on mount) doesn't spuriously re-render or
// re-trigger the state→URL sync effect.
export function eventFiltersEqual(a: EventFilters, b: EventFilters): boolean {
    const arraysEqual = (x: readonly unknown[], y: readonly unknown[]) =>
        x.length === y.length && x.every((v, i) => v === y[i]);
    return a.itraAny === b.itraAny
        && a.weekendOnly === b.weekendOnly
        && a.thisWeekOnly === b.thisWeekOnly
        && a.nextWeekOnly === b.nextWeekOnly
        && a.mountainRaceOnly === b.mountainRaceOnly
        && a.favoritesOnly === b.favoritesOnly
        && arraysEqual(a.activityTypes, b.activityTypes)
        && arraysEqual(a.months, b.months)
        && arraysEqual(a.locations, b.locations)
        && arraysEqual(a.itraPoints, b.itraPoints)
        && arraysEqual(a.certifications, b.certifications)
        && arraysEqual(a.championships, b.championships)
        && arraysEqual(a.distanceBuckets, b.distanceBuckets);
}

export function parseDistanceKm(label: string): number | null {
    const m = label.match(/^(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
}

export function matchesDistanceBucket(km: number, bucket: RaceDistanceBucket): boolean {
    if (bucket === '<10') return km < 10;
    if (bucket === '10-21') return km >= 10 && km < 21.1;
    if (bucket === '21-42') return km >= 21.1 && km < 42.195;
    if (bucket === '42-100') return km >= 42.195 && km < 100;
    return km >= 100;
}

// #1333: used by applyFilters's thisWeekOnly/nextWeekOnly checks — true when the event's own
// representative date (displayDate/nextEditionDate) falls in [start, end], OR, for a Series
// event, when any of its seriesRaces dates does. Exported for direct unit coverage of the
// Series-only branch (see eventFilters.test.ts) independent of the getWeekRange('this'/'next')
// plumbing in applyFilters itself.
export function eventHasDateInRange(c: EventSummary, start: string, end: string): boolean {
    const d = c.displayDate ?? c.nextEditionDate;
    if (d && d >= start && d <= end) return true;
    if (c.type !== 'Series' || !c.seriesRaces) return false;
    return c.seriesRaces.some(race => !!race.dateOfRace && race.dateOfRace >= start && race.dateOfRace <= end);
}

// #1427: same shape as eventHasDateInRange above, for the month-pill filter instead of the
// week-pill filters — true when the event's own representative date (displayDate/
// nextEditionDate) falls in a selected month, OR, for a Series event, when any of its
// seriesRaces dates does. Without the seriesRaces branch, a multi-month series (e.g. Powerade
// Vetrarhlaupin, Oct-Mar) only ever shows up for its season's *first* month, since
// displayDate/nextEditionDate is pinned to min(raceDates) — see the eventUtils.ts comment on
// that staleness. Exported for direct unit coverage (see eventFilters.test.ts), mirroring
// eventHasDateInRange.
export function eventHasMonthInSet(c: EventSummary, months: number[]): boolean {
    const d = c.displayDate ?? c.nextEditionDate;
    if (d && months.includes(new Date(d + 'T00:00:00').getMonth())) return true;
    if (c.type !== 'Series' || !c.seriesRaces) return false;
    return c.seriesRaces.some(race => !!race.dateOfRace && months.includes(new Date(race.dateOfRace + 'T00:00:00').getMonth()));
}

// #1427: RacesPage's `monthsWithEvents` (which gates which month chips render at all) used to
// collect only each event's own displayDate/nextEditionDate month — for a multi-month Series
// event that's the season's *first* month only, so a later month with a real race (e.g. "Nov" for
// Powerade Vetrarhlaupin) never got a chip, making eventHasMonthInSet/filterRowsByMonths above
// unreachable from the UI for exactly the scenario #1427 describes. Returns every distinct month
// an event should contribute a chip for: its own displayDate/nextEditionDate month, plus, for a
// Series event, every seriesRaces date's month — same two sources eventHasMonthInSet checks,
// collected rather than tested against a target set.
export function eventMonths(c: EventSummary): number[] {
    const months = new Set<number>();
    const d = c.displayDate ?? c.nextEditionDate;
    if (d) months.add(new Date(d + 'T00:00:00').getMonth());
    if (c.type === 'Series' && c.seriesRaces) {
        for (const race of c.seriesRaces) {
            if (race.dateOfRace) months.add(new Date(race.dateOfRace + 'T00:00:00').getMonth());
        }
    }
    return [...months];
}

// Shared filter steps used by RacesPage's `filtered`, `hasMoreEventsIncludingPast`, and
// `monthsWithEvents`. Add new filter types here — all three consumers pick them up automatically.
// `favoriteEvents`/`includeAllEvents` are explicit parameters (not closure captures over component
// state) so this stays a pure, independently testable function — see eventFilters.test.ts.
export function applyFilters(
    base: EventSummary[],
    f: EventFilters,
    q: string,
    favoriteEvents: string[],
    includeAllEvents: boolean,
    skipMonth = false,
): EventSummary[] {
    let result = base;
    if (q) result = result.filter(c => c.name.toLowerCase().includes(q) || c.locationName?.toLowerCase().includes(q) || c.organizerName?.toLowerCase().includes(q));
    // #985: default to upcoming events only while a search is active — `includeAllEvents`
    // (or the explicit `includeAll` override used to probe "would broadening help?") lifts it.
    if (q && !includeAllEvents) result = result.filter(c => c.daysUntil !== null && c.daysUntil >= 0);
    // #988: hide dateless events (no displayDate/nextEditionDate, so no confirmed future
    // edition) from the default browse view — they'd otherwise sit permanently at the bottom
    // of a page meant to be forward-looking. Only applies with no search text; #985 already
    // owns search-time dateless/past behavior via includeAll above, so leave that untouched.
    if (!q) result = result.filter(c => c.daysUntil !== null);
    if (f.locations.length > 0) result = result.filter(c => c.locationName && f.locations.includes(c.locationName));
    // #1427: a Series event's displayDate/nextEditionDate only ever names its season's *first*
    // race (see eventUtils.ts's staleness comment), so the event-level check used to drop the
    // whole event once a later month was selected even though a later race in the same
    // seriesRaces list actually falls in that month. eventHasMonthInSet checks seriesRaces too,
    // keeping the event whenever ANY of its races qualifies — filterRowsByMonths (eventUtils.ts)
    // then narrows the rendered rows back down to just the race(s) actually in the selected
    // month(s), same two-pass pattern #1333 already established for thisWeekOnly/nextWeekOnly.
    if (!skipMonth && f.months.length > 0) result = result.filter(c => eventHasMonthInSet(c, f.months));
    if (f.activityTypes.length > 0) result = result.filter(c => f.activityTypes.includes(c.activityType));
    if (f.itraAny) result = result.filter(c => c.itraPoints && c.itraPoints.length > 0);
    else if (f.itraPoints.length > 0) result = result.filter(c => c.itraPoints?.some(p => f.itraPoints.includes(p)));
    if (f.certifications.length > 0) result = result.filter(c => c.certifications?.some(cert => f.certifications.includes(cert)));
    if (f.championships.length > 0) result = result.filter(c => c.championshipCategories?.some(ch => f.championships.includes(ch)));
    if (f.weekendOnly) result = result.filter(c => { const d = c.displayDate ?? c.nextEditionDate; if (!d) return false; const day = new Date(d + 'T00:00:00').getDay(); return day === 0 || day === 6; });
    // #1333: a Series event's displayDate/nextEditionDate only ever names its *next* race — once
    // that race is in the past (or just outside the target week), the event-level check below used
    // to drop the whole event even when a later race in the same seriesRaces list actually falls
    // inside the target week (e.g. a 6-race series whose soonest race is next week but a later one
    // is the week after). Checking seriesRaces too keeps the event in the result set whenever ANY
    // of its races qualifies — flattenEventRows's row-level filter (eventUtils.ts) then narrows the
    // rendered rows back down to just the race(s) actually in range.
    if (f.thisWeekOnly) { const { start, end } = getWeekRange('this'); result = result.filter(c => eventHasDateInRange(c, start, end)); }
    if (f.nextWeekOnly) { const { start, end } = getWeekRange('next'); result = result.filter(c => eventHasDateInRange(c, start, end)); }
    if (f.mountainRaceOnly) result = result.filter(c => c.isMountainRace === true);
    if (f.favoritesOnly) result = result.filter(c => favoriteEvents.includes(c.slug));
    if (f.distanceBuckets.length > 0) result = result.filter(c => {
        if (!c.distances?.length) return false;
        return c.distances.some(d => {
            const km = parseDistanceKm(d.label);
            if (km === null) return true; // unparseable label: include rather than silently drop
            return f.distanceBuckets.some(b => matchesDistanceBucket(km, b));
        });
    });
    return result;
}

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
    if (!skipMonth && f.months.length > 0) result = result.filter(c => { const d = c.displayDate ?? c.nextEditionDate; return !!d && f.months.includes(new Date(d + 'T00:00:00').getMonth()); });
    if (f.activityTypes.length > 0) result = result.filter(c => f.activityTypes.includes(c.activityType));
    if (f.itraAny) result = result.filter(c => c.itraPoints && c.itraPoints.length > 0);
    else if (f.itraPoints.length > 0) result = result.filter(c => c.itraPoints?.some(p => f.itraPoints.includes(p)));
    if (f.certifications.length > 0) result = result.filter(c => c.certifications?.some(cert => f.certifications.includes(cert)));
    if (f.championships.length > 0) result = result.filter(c => c.championshipCategories?.some(ch => f.championships.includes(ch)));
    if (f.weekendOnly) result = result.filter(c => { const d = c.displayDate ?? c.nextEditionDate; if (!d) return false; const day = new Date(d + 'T00:00:00').getDay(); return day === 0 || day === 6; });
    if (f.thisWeekOnly) { const { start, end } = getWeekRange('this'); result = result.filter(c => { const d = c.displayDate ?? c.nextEditionDate; return !!d && d >= start && d <= end; }); }
    if (f.nextWeekOnly) { const { start, end } = getWeekRange('next'); result = result.filter(c => { const d = c.displayDate ?? c.nextEditionDate; return !!d && d >= start && d <= end; }); }
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

import type { FlattenedEventRow } from './eventUtils';
import { BRAND_NAME, localeForHostname } from '../api/_site';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

// #1495: mirrors frontend/i18n/i18n.ts's brandNameForHostname composition, but imports
// BRAND_NAME/localeForHostname straight from _site.ts rather than importing the function itself
// from i18n.ts — i18n.ts computes its own module-scope brandName/initialLang as an import-time
// side effect that reads window.location.hostname/localStorage (see i18n.ts's own comment on why
// that has to happen at load time), so importing it here would force every test that imports this
// file — including ones with nothing to do with hostnames — to also vi.stubGlobal those two
// globals, same gotcha i18n.test.ts documents. _site.ts has no such side effect.
function brandNameForHostname(hostname: string): string {
    return BRAND_NAME[localeForHostname(hostname)];
}

// #1495: heading line for both "Copy list" clipboard texts — "{{brandName}} – Events"/
// "{{brandName}} – Trails". Brand is resolved the same host-based way as every other BRAND_NAME
// consumer (Layout.tsx's header, usePageTitle.ts's tab title, ...), never hardcoded; `nav.trails`/
// `nav.events` are the same labels the main nav already renders, reused rather than re-literalled.
export function formatListHeading(kind: 'trails' | 'events', t: TFunc, hostname: string): string {
    const brand = brandNameForHostname(hostname);
    const label = kind === 'trails' ? t('nav.trails') : t('nav.events');
    return `${brand} – ${label}`;
}

// #1495: one already-resolved on-screen Key/Value pair for the "Filters:" summary block — the
// filter-state → label mapping itself lives in TrailList.tsx/RacesPage.tsx (each section's/
// bucket's label text is already defined there for the Chip it renders; duplicating that mapping
// here would be a second source of truth for filter wording), so this file only has to join
// already-resolved pairs into lines.
export interface ActiveFilterLine {
    label: string;
    value: string;
}

// Builds the "Filters:" block appended to a copied list's clipboard text — one "  Key: Value" line
// per `entries`, in the order the caller supplied them. Returns [] (nothing to render) when no
// filter is active, so callers can splice the result into their line array unconditionally rather
// than branching on it themselves.
export function formatActiveFiltersSummary(entries: ActiveFilterLine[], t: TFunc): string[] {
    if (entries.length === 0) return [];
    return [t('common.filtersHeading'), ...entries.map(({ label, value }) => `  ${label}: ${value}`)];
}

// A single flattened event/race line destined for the clipboard text — deliberately narrower than
// FlattenedEventRow itself (just the date to group by and the already-localized display name,
// plus the #1495 distance/elevation additions below) so the grouping/formatting functions below
// stay pure and don't need a `loc()`/i18n dependency of their own; callers (RacesPage) resolve
// localization before handing rows here.
export interface CopyableEventRow {
    dateStr: string | null;
    name: string;
    distanceLabel?: string | null;
    elevationGain?: number | null;
}

// Mirrors admin/src/utils/eventHelpers.ts's flattenEventRows → row mapping, but keeps a Series
// event's event-level name alongside each of its race names (" · " separated, matching the visual
// "event · race" title RacesPage already renders for a series-race row) rather than dropping it —
// a copied agenda with only "Race 3" and no series name would be unreadable out of context.
export function toCopyableEventRows(
    rows: FlattenedEventRow[],
    loc: (is: string | null | undefined, en: string | null | undefined) => string | null,
): CopyableEventRow[] {
    return rows.map(row => {
        if (row.kind === 'series-race') {
            const eventName = loc(row.event.name, row.event.nameEn) ?? row.event.name;
            const raceName = loc(row.race.raceName, row.race.raceNameEn) ?? row.race.raceName;
            const elevationGain = row.race.trailElevationGain ?? null;
            return { dateStr: row.rowDate, name: `${eventName} · ${raceName}`, distanceLabel: row.race.distanceLabel, elevationGain };
        }
        // A plain (non-Series) event's `distances` is an aggregate list across all of its races —
        // only safe to show as "the" distance for this one row when there's exactly one entry;
        // with several (e.g. a marathon + a half on the same day) there's no single distance to
        // attribute to one bulleted line, so it's omitted rather than guessing. No elevation field
        // exists on that aggregate shape at all (RaceDistanceSummaryDto has only Label/
        // TicketStatus), so it's always omitted for this row kind.
        const distanceLabel = row.event.distances?.length === 1 ? row.event.distances[0].label : null;
        return { dateStr: row.rowDate, name: loc(row.event.name, row.event.nameEn) ?? row.event.name, distanceLabel, elevationGain: null };
    });
}

// Header for the copied event agenda, derived from the actual earliest/latest date present in the
// result set being copied — not from filter-state introspection (unlike admin's formatAgendaHeader,
// which reads weekFilter/yearFilter/monthFilter directly). The frontend's filter combinations
// (search text, activity type, months pills, favorites, week toggles, ...) don't map onto admin's
// week/month/year filter states, so the header has to be read back off the data instead. See #1483.
export function formatEventListHeader(dates: string[], t: TFunc): string {
    if (dates.length === 0) return '';
    const sorted = [...dates].sort();
    const startStr = sorted[0];
    const endStr = sorted[sorted.length - 1];
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    if (startStr === endStr) {
        return `${start.getDate()}. ${months[start.getMonth()]} ${start.getFullYear()}`;
    }
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    return sameMonth
        ? `${start.getDate()}. – ${end.getDate()}. ${months[end.getMonth()]} ${end.getFullYear()}`
        : `${start.getDate()}. ${months[start.getMonth()]} – ${end.getDate()}. ${months[end.getMonth()]} ${end.getFullYear()}`;
}

// #1495: appends a row's distance/elevation gain (in that order, " · "-separated) after its name,
// omitting either value — rather than leaving a stray " · " — when not available for that row
// (e.g. a multi-distance plain event, or a series race with no linked trail's elevation yet).
// Shared by the event-row and trail-row renderers below so the two stay in lockstep.
function appendDistanceElevation(name: string, distanceLabel: string | null | undefined, elevationGain: number | null | undefined): string {
    const extras = [
        distanceLabel ?? null,
        elevationGain != null ? `${Math.round(elevationGain)} m` : null,
    ].filter((v): v is string => v !== null);
    return extras.length > 0 ? `${name} · ${extras.join(' · ')}` : name;
}

// Builds the full clipboard text for the events list: a date header, then one "<day> <date>."
// line per distinct date with each event/race name bulleted underneath — ports the shape of
// admin's handleCopyAgenda, but bilingual (races.weekdaysShort/races.months come from i18n rather
// than the admin util's Icelandic-only MONTHS_IS_FULL/inline DAY_NAMES). Rows with no date (an
// unconfirmed/TBD edition) still render as a visible card on RacesPage, so they are NOT dropped —
// that would silently paste fewer lines than are on screen (#1488 review) — but grouped last,
// under races.noDate, since there's no date to sort them by. Returns '' when nothing is copyable.
//
// #1495: `filterLines` is the caller's already-built formatActiveFiltersSummary() output (or []
// when no filter is active) — spliced in right after the date-range header (or, when every row is
// dateless and there's no date-range header at all, right before the races.noDate group), so the
// clipboard text reads heading → date range → filters → list, matching TrailList's equivalent
// ordering. Defaults to [] so existing call sites/tests that don't pass it are unaffected.
export function formatEventListForClipboard(rows: CopyableEventRow[], t: TFunc, filterLines: string[] = []): string {
    const byDate = new Map<string, string[]>();
    const undated: string[] = [];
    for (const row of rows) {
        const rendered = appendDistanceElevation(row.name, row.distanceLabel, row.elevationGain);
        if (!row.dateStr) { undated.push(rendered); continue; }
        if (!byDate.has(row.dateStr)) byDate.set(row.dateStr, []);
        byDate.get(row.dateStr)!.push(rendered);
    }
    if (byDate.size === 0 && undated.length === 0) return '';

    const sortedDates = [...byDate.keys()].sort();
    const dayNames = t('races.weekdaysShort', { returnObjects: true }) as unknown as string[];
    const months = t('races.months', { returnObjects: true }) as unknown as string[];

    const lines: string[] = [];
    if (sortedDates.length > 0) {
        lines.push(formatEventListHeader(sortedDates, t), '');
    }
    if (filterLines.length > 0) {
        lines.push(...filterLines, '');
    }
    if (sortedDates.length > 0) {
        for (const dateStr of sortedDates) {
            const d = new Date(dateStr + 'T00:00:00');
            lines.push(`${dayNames[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`);
            for (const name of byDate.get(dateStr)!) lines.push(`  • ${name}`);
            lines.push('');
        }
    }
    if (undated.length > 0) {
        lines.push(t('races.noDate'));
        for (const name of undated) lines.push(`  • ${name}`);
        lines.push('');
    }
    return lines.join('\n').trimEnd();
}

export interface CopyableTrailRow {
    name: string;
    location?: string | null;
    lengthKm?: number | null;
    elevationGain?: number | null;
}

// Simpler sibling of formatEventListForClipboard for the trails list — no date grouping (trails
// aren't dated), just a flat bulleted list, optionally with each trail's primary location in
// parentheses, plus (#1495) its length/elevation gain " · "-separated after that, each omitted
// individually when unavailable for that trail.
export function formatTrailListForClipboard(rows: CopyableTrailRow[]): string {
    return rows.map(row => {
        const name = row.location ? `${row.name} (${row.location})` : row.name;
        return `• ${appendDistanceElevation(name, row.lengthKm != null ? `${row.lengthKm.toFixed(1)} km` : null, row.elevationGain)}`;
    }).join('\n');
}

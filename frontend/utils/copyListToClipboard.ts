import type { FlattenedEventRow } from './eventUtils';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

// A single flattened event/race line destined for the clipboard text — deliberately narrower than
// FlattenedEventRow itself (just the date to group by and the already-localized display name) so
// the grouping/formatting functions below stay pure and don't need a `loc()`/i18n dependency of
// their own; callers (RacesPage) resolve localization before handing rows here.
export interface CopyableEventRow {
    dateStr: string | null;
    name: string;
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
            return { dateStr: row.rowDate, name: `${eventName} · ${raceName}` };
        }
        return { dateStr: row.rowDate, name: loc(row.event.name, row.event.nameEn) ?? row.event.name };
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

// Builds the full clipboard text for the events list: a date header, then one "<day> <date>."
// line per distinct date with each event/race name bulleted underneath — ports the shape of
// admin's handleCopyAgenda, but bilingual (races.weekdaysShort/races.months come from i18n rather
// than the admin util's Icelandic-only MONTHS_IS_FULL/inline DAY_NAMES). Rows with no date are
// dropped — there's no date line to group them under. Returns '' when nothing is copyable.
export function formatEventListForClipboard(rows: CopyableEventRow[], t: TFunc): string {
    const byDate = new Map<string, string[]>();
    for (const row of rows) {
        if (!row.dateStr) continue;
        if (!byDate.has(row.dateStr)) byDate.set(row.dateStr, []);
        byDate.get(row.dateStr)!.push(row.name);
    }
    if (byDate.size === 0) return '';

    const sortedDates = [...byDate.keys()].sort();
    const dayNames = t('races.weekdaysShort', { returnObjects: true }) as unknown as string[];
    const months = t('races.months', { returnObjects: true }) as unknown as string[];

    const lines: string[] = [formatEventListHeader(sortedDates, t), ''];
    for (const dateStr of sortedDates) {
        const d = new Date(dateStr + 'T00:00:00');
        lines.push(`${dayNames[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`);
        for (const name of byDate.get(dateStr)!) lines.push(`  • ${name}`);
        lines.push('');
    }
    return lines.join('\n').trimEnd();
}

export interface CopyableTrailRow {
    name: string;
    location?: string | null;
}

// Simpler sibling of formatEventListForClipboard for the trails list — no date grouping (trails
// aren't dated), just a flat bulleted list, optionally with each trail's primary location in
// parentheses.
export function formatTrailListForClipboard(rows: CopyableTrailRow[]): string {
    return rows.map(row => row.location ? `• ${row.name} (${row.location})` : `• ${row.name}`).join('\n');
}

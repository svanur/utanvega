import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, deriveEventTrailSlugs, flattenEventRows, formatYearRanges, getEditionTimingStatus, getRowDaysUntil, getWeekRange, msUntilNextMidnight, shortestUniqueEditionKey } from './eventUtils';
import type { EventSummary, SeriesRaceDto } from '../hooks/useEvents';

// Minimal EventSummary factory — mirrors the one in eventFilters.test.ts; only the fields
// flattenEventRows/getRowDaysUntil actually read are meaningful, the rest are harmless defaults.
function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
    return {
        id: overrides.slug ?? 'event-1',
        name: 'Test Race',
        nameEn: null,
        slug: 'test-race',
        description: null,
        descriptionEn: null,
        type: 'Race',
        activityType: 'TrailRunning',
        activityTypes: null,
        status: 'Active',
        organizerId: null,
        organizerName: null,
        organizerNameEn: null,
        organizerWebsite: null,
        organizerSlug: null,
        alertMessage: null,
        alertMessageEn: null,
        alertSeverity: null,
        locationId: null,
        locationName: null,
        scheduleRule: null,
        socialLinks: null,
        nextEditionDate: null,
        daysUntil: 10,
        displayDate: '2026-06-15',
        editionCount: 1,
        distances: null,
        registrationUrl: null,
        registrationStatus: null,
        registrationCloses: null,
        resultsUrl: null,
        galleries: [],
        certifications: null,
        youtubeUrl: null,
        championshipCategories: null,
        itraPoints: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
        seriesRaces: null,
        recentlyCompletedSeriesRace: null,
        gpxPointLat: null,
        gpxPointLng: null,
        isMountainRace: false,
        endDisplayDate: null,
        editionStatus: null,
        editionEffectiveCancelled: false,
        ...overrides,
    };
}

function makeSeriesRace(overrides: Partial<SeriesRaceDto> = {}): SeriesRaceDto {
    return {
        raceId: 'race-1',
        raceName: 'Test Sub-Race',
        raceNameEn: null,
        dateOfRace: '2026-07-01',
        startTime: null,
        distanceLabel: null,
        ticketStatus: 'Available',
        registrationUrl: null,
        ...overrides,
    };
}

// #546: the recorded-editions badge must be gap-tolerant — a missing year in the middle of the
// record must stay visible as a gap, never smoothed into a continuous range.
describe('formatYearRanges', () => {
    it('collapses a single consecutive run into a range', () => {
        expect(formatYearRanges([2021, 2022, 2023, 2024, 2025])).toBe('2021–2025');
    });

    it('keeps a gap visible instead of smoothing it into one range', () => {
        expect(formatYearRanges([2018, 2021, 2022, 2023, 2024, 2025])).toBe('2018, 2021–2025');
    });

    it('lists fully non-consecutive years individually', () => {
        expect(formatYearRanges([2018, 2020, 2022])).toBe('2018, 2020, 2022');
    });

    it('renders a single year as itself, not a range', () => {
        expect(formatYearRanges([2020])).toBe('2020');
    });

    it('renders a two-year consecutive pair as a range', () => {
        expect(formatYearRanges([2019, 2020])).toBe('2019–2020');
    });

    it('is tolerant of unsorted, duplicated input', () => {
        expect(formatYearRanges([2023, 2021, 2022, 2021])).toBe('2021–2023');
    });

    it('returns an empty string for no years', () => {
        expect(formatYearRanges([])).toBe('');
    });
});

// #711: getEditionTimingStatus drives the timing chip on EditionHistoryPage — the comparison must
// be date-only (calendar dates), never sensitive to the time of day passed in `now`.
describe('getEditionTimingStatus', () => {
    it('returns "past" for a single-day edition dated before today', () => {
        const now = new Date('2026-03-15T00:00:00');
        expect(getEditionTimingStatus('2026-03-10', undefined, now)).toBe('past');
    });

    it('returns "ongoing" for a single-day edition dated today', () => {
        const now = new Date('2026-03-15T00:00:00');
        expect(getEditionTimingStatus('2026-03-15', undefined, now)).toBe('ongoing');
    });

    it('returns "upcoming" for a single-day edition dated after today', () => {
        const now = new Date('2026-03-15T00:00:00');
        expect(getEditionTimingStatus('2026-03-20', undefined, now)).toBe('upcoming');
    });

    it('returns "ongoing" for a multi-day edition where today falls within [date, endDate]', () => {
        const now = new Date('2026-03-16T00:00:00');
        expect(getEditionTimingStatus('2026-03-14', '2026-03-18', now)).toBe('ongoing');
    });

    it('returns "upcoming" for a multi-day edition where today is before date', () => {
        const now = new Date('2026-03-10T00:00:00');
        expect(getEditionTimingStatus('2026-03-14', '2026-03-18', now)).toBe('upcoming');
    });

    it('returns "past" for a multi-day edition where today is after endDate', () => {
        const now = new Date('2026-03-20T00:00:00');
        expect(getEditionTimingStatus('2026-03-14', '2026-03-18', now)).toBe('past');
    });

    it('returns null when date is null or undefined', () => {
        expect(getEditionTimingStatus(null, undefined, new Date('2026-03-15T00:00:00'))).toBeNull();
        expect(getEditionTimingStatus(undefined, undefined, new Date('2026-03-15T00:00:00'))).toBeNull();
    });

    it('compares dates only, ignoring time of day — a late "now" on edition day is still "ongoing"', () => {
        const now = new Date('2026-03-15T23:59:59');
        expect(getEditionTimingStatus('2026-03-15', undefined, now)).toBe('ongoing');
    });
});

// #759: extracted from EditionHistoryPage's midnight-scheduling useEffect so the boundary math
// (an exact-midnight `now` must still yield a full 24h, not 0) is unit-testable.
describe('msUntilNextMidnight', () => {
    it('returns a small positive value for a "now" just before midnight', () => {
        const now = new Date('2026-03-15T23:59:59.500');
        expect(msUntilNextMidnight(now)).toBe(500);
    });

    it('returns a full 24h when "now" is exactly midnight', () => {
        const now = new Date('2026-03-15T00:00:00.000');
        expect(msUntilNextMidnight(now)).toBe(86400000);
    });

    it('returns the remaining ms in the day for a "now" mid-day', () => {
        const now = new Date('2026-03-15T12:00:00.000');
        expect(msUntilNextMidnight(now)).toBe(12 * 60 * 60 * 1000);
    });
});

// #1223: EventTableView's series sub-race countdown chip computed Math.round((raceMidnight -
// nowMs) / 86400000) with `nowMs` a raw timestamp instead of a midnight-normalized one — on race
// day, once any time had elapsed, the diff went negative-fractional and rounded to -1, showing
// "Yesterday" instead of "Today". daysBetween normalizes both sides to local midnight first, like
// getEditionTimingStatus above, so the result can't depend on what time of day `now` is.
describe('daysBetween', () => {
    it('returns 0 for today checked late in the day — the exact #1223 repro', () => {
        const now = new Date('2026-03-15T23:00:00');
        expect(daysBetween('2026-03-15', now)).toBe(0);
    });

    it('returns 0 for today checked just after midnight', () => {
        const now = new Date('2026-03-15T00:00:01');
        expect(daysBetween('2026-03-15', now)).toBe(0);
    });

    it('returns -1 for yesterday, not -2, even checked just after midnight', () => {
        const now = new Date('2026-03-15T00:00:01');
        expect(daysBetween('2026-03-14', now)).toBe(-1);
    });

    it('returns 1 for tomorrow', () => {
        const now = new Date('2026-03-15T12:00:00');
        expect(daysBetween('2026-03-16', now)).toBe(1);
    });

    it('returns -1 for yesterday checked late in the day', () => {
        const now = new Date('2026-03-15T23:00:00');
        expect(daysBetween('2026-03-14', now)).toBe(-1);
    });

    it('returns 1 for tomorrow checked late in the day', () => {
        const now = new Date('2026-03-15T23:00:00');
        expect(daysBetween('2026-03-16', now)).toBe(1);
    });
});

// #1227: flattenEventRows replaces the two independent copies of this exact loop that used to
// live in EventTableView and RacesPage (one named the row field `event`, the other `comp`) —
// exploding a Series event's seriesRaces into one row per race, leaving every other event/type as
// a single row, with rowDate precomputed so sorting and year-divider/holiday-banner grouping read
// the exact same value instead of re-deriving their own ternary.
describe('flattenEventRows', () => {
    it('keeps a non-Series event as a single "event" row, with rowDate from displayDate', () => {
        const event = makeEvent({ type: 'Race', displayDate: '2026-06-15', nextEditionDate: '2026-06-01' });
        const rows = flattenEventRows([event]);
        expect(rows).toEqual([{ kind: 'event', event, rowDate: '2026-06-15' }]);
    });

    it('falls back to nextEditionDate for rowDate when displayDate is null', () => {
        const event = makeEvent({ displayDate: null, nextEditionDate: '2026-06-01' });
        const rows = flattenEventRows([event]);
        expect(rows[0].rowDate).toBe('2026-06-01');
    });

    it('explodes a Series event into one row per seriesRace, each carrying the parent event', () => {
        const raceA = makeSeriesRace({ raceId: 'a', dateOfRace: '2026-05-01' });
        const raceB = makeSeriesRace({ raceId: 'b', dateOfRace: '2026-09-01' });
        const event = makeEvent({ type: 'Series', seriesRaces: [raceA, raceB] });
        const rows = flattenEventRows([event]);
        expect(rows).toEqual([
            { kind: 'series-race', event, race: raceA, rowDate: '2026-05-01' },
            { kind: 'series-race', event, race: raceB, rowDate: '2026-09-01' },
        ]);
    });

    it('treats a Series event with an empty seriesRaces array as a plain single row', () => {
        const event = makeEvent({ type: 'Series', seriesRaces: [] });
        const rows = flattenEventRows([event]);
        expect(rows).toEqual([{ kind: 'event', event, rowDate: event.displayDate }]);
    });

    it('treats a Series event with a null seriesRaces as a plain single row', () => {
        const event = makeEvent({ type: 'Series', seriesRaces: null });
        const rows = flattenEventRows([event]);
        expect(rows).toEqual([{ kind: 'event', event, rowDate: event.displayDate }]);
    });

    it('preserves input order across a mix of plain events and exploded series rows', () => {
        const plain = makeEvent({ slug: 'plain' });
        const seriesRace = makeSeriesRace();
        const series = makeEvent({ slug: 'series', type: 'Series', seriesRaces: [seriesRace] });
        const rows = flattenEventRows([plain, series]);
        expect(rows.map(r => r.kind)).toEqual(['event', 'series-race']);
    });

    // #1244: recentlyCompletedSeriesRace is a separate, explicitly-opted-in field from
    // seriesRaces (which is future-only) — ignored by default so RacesPage's main upcoming list
    // (which renders its own dedicated "Nýlokið" card) doesn't double it up.
    it('ignores recentlyCompletedSeriesRace by default (includeRecentlyCompleted omitted)', () => {
        const recentRace = makeSeriesRace({ raceId: 'recent', dateOfRace: '2026-10-08' });
        const event = makeEvent({ type: 'Series', seriesRaces: null, recentlyCompletedSeriesRace: recentRace });
        const rows = flattenEventRows([event]);
        expect(rows).toEqual([{ kind: 'event', event, rowDate: event.displayDate }]);
    });

    it('ignores recentlyCompletedSeriesRace when includeRecentlyCompleted is explicitly false', () => {
        const recentRace = makeSeriesRace({ raceId: 'recent', dateOfRace: '2026-10-08' });
        const event = makeEvent({ type: 'Series', seriesRaces: null, recentlyCompletedSeriesRace: recentRace });
        const rows = flattenEventRows([event], false);
        expect(rows).toEqual([{ kind: 'event', event, rowDate: event.displayDate }]);
    });

    it('appends a series-race row for recentlyCompletedSeriesRace when includeRecentlyCompleted is true', () => {
        const recentRace = makeSeriesRace({ raceId: 'recent', dateOfRace: '2026-10-08' });
        const event = makeEvent({ type: 'Series', seriesRaces: null, recentlyCompletedSeriesRace: recentRace });
        const rows = flattenEventRows([event], true);
        expect(rows).toEqual([
            { kind: 'event', event, rowDate: event.displayDate },
            { kind: 'series-race', event, race: recentRace, rowDate: '2026-10-08' },
        ]);
    });

    it('appends the recently-completed row alongside the future seriesRaces rows, not instead of them', () => {
        const futureRace = makeSeriesRace({ raceId: 'future', dateOfRace: '2026-10-15' });
        const recentRace = makeSeriesRace({ raceId: 'recent', dateOfRace: '2026-10-08' });
        const event = makeEvent({ type: 'Series', seriesRaces: [futureRace], recentlyCompletedSeriesRace: recentRace });
        const rows = flattenEventRows([event], true);
        expect(rows).toEqual([
            { kind: 'series-race', event, race: futureRace, rowDate: '2026-10-15' },
            { kind: 'series-race', event, race: recentRace, rowDate: '2026-10-08' },
        ]);
    });
});

// #1223/#1226/#1227: this ternary (dateOfRace ? daysBetween(...) : null) drifted between
// EventTableView and RacesPage once already — getRowDaysUntil is the single place it's computed
// now. A plain "event" row keeps using the backend-precomputed daysUntil as-is, never recomputing
// it from a date string.
describe('getRowDaysUntil', () => {
    it('computes days-until from the series race\'s own dateOfRace, not the parent event\'s', () => {
        const now = new Date('2026-03-15T00:00:00');
        const event = makeEvent({ displayDate: '2099-01-01' }); // deliberately far off, must be ignored
        const race = makeSeriesRace({ dateOfRace: '2026-03-20' });
        const row = { kind: 'series-race' as const, event, race, rowDate: race.dateOfRace };
        expect(getRowDaysUntil(row, now)).toBe(5);
    });

    it('returns null for a series-race row whose race has no dateOfRace', () => {
        const now = new Date('2026-03-15T00:00:00');
        const event = makeEvent();
        const race = makeSeriesRace({ dateOfRace: null });
        const row = { kind: 'series-race' as const, event, race, rowDate: null };
        expect(getRowDaysUntil(row, now)).toBeNull();
    });

    it('returns the event\'s own backend-precomputed daysUntil for a plain "event" row', () => {
        const event = makeEvent({ daysUntil: 42 });
        const row = { kind: 'event' as const, event, rowDate: event.displayDate };
        expect(getRowDaysUntil(row, new Date('2026-03-15T00:00:00'))).toBe(42);
    });

    it('defaults `now` to the current time when not provided', () => {
        const today = new Date().toISOString().slice(0, 10);
        const event = makeEvent();
        const race = makeSeriesRace({ dateOfRace: today });
        const row = { kind: 'series-race' as const, event, race, rowDate: race.dateOfRace };
        expect(getRowDaysUntil(row)).toBe(0);
    });
});

// #843: addDays and getWeekRange were previously local, unexported helpers duplicated between
// RacesPage.tsx and eventUtils.ts (toDateOnlyString) — moved here so they're shared and tested.
describe('addDays', () => {
    it('crosses a month boundary', () => {
        const result = addDays(new Date('2026-01-28T00:00:00'), 5);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(2);
    });

    it('crosses a year boundary', () => {
        const result = addDays(new Date('2025-12-29T00:00:00'), 5);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(3);
    });
});

// #783: shortestUniqueEditionKey shortens the /history/:editionKey URL to the year alone when
// that's unambiguous among sibling editions of the same event, only falling back to the full date
// (and then the id) as needed to stay unique — same-year and even same-date collisions are legal
// (EventEdition.Year/Date have no unique constraint), so uniqueness must be checked, not assumed.
describe('shortestUniqueEditionKey', () => {
    it('prefers the year when no sibling shares it, even if the edition has an exact date', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        const siblings = [edition, { id: 'b', date: '2024-06-15', year: 2024 }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('2025');
    });

    it('falls back to the full date when a sibling shares the year but not the date', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        const siblings = [edition, { id: 'b', date: '2025-09-20', year: 2025 }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('2025-06-14');
    });

    it('falls back to the id when siblings share both year and date', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        const siblings = [edition, { id: 'b', date: '2025-06-14', year: 2025 }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('a');
    });

    it('falls back to the id when the edition has neither date nor year', () => {
        const edition = { id: 'a', date: null, year: null };
        const siblings = [edition, { id: 'b', date: null, year: null }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('a');
    });

    it('treats a single-edition series (one edition per season) as unambiguous — year-only', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        expect(shortestUniqueEditionKey(edition, [edition])).toBe('2025');
    });
});

// #855: getWeekRange takes an injectable `now`, matching the other functions in this file, so
// "today" is passed directly as an argument rather than pinned with fake timers.
describe('getWeekRange', () => {
    it('"this" week returns Monday start / Sunday end six days later, for a Tue "now"', () => {
        const now = new Date('2026-03-10T09:00:00'); // Tuesday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    });

    it('"this" week returns the same Monday start / Sunday end for a Sat "now" in the same week', () => {
        const now = new Date('2026-03-14T09:00:00'); // Saturday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    });

    it('"next" week returns the Monday immediately after the current week\'s Sunday', () => {
        const now = new Date('2026-03-10T09:00:00'); // Tuesday, this week ends Sun 2026-03-15
        expect(getWeekRange('next', now)).toEqual({ start: '2026-03-16', end: '2026-03-22' });
    });

    it('boundary: "now" is a Sunday — "this" week starts the preceding Monday and ends today', () => {
        const now = new Date('2026-03-15T09:00:00'); // Sunday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
        expect(getWeekRange('next', now)).toEqual({ start: '2026-03-16', end: '2026-03-22' });
    });

    it('boundary: "now" is a Monday — "this" week starts today', () => {
        const now = new Date('2026-03-16T09:00:00'); // Monday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-16', end: '2026-03-22' });
        expect(getWeekRange('next', now)).toEqual({ start: '2026-03-23', end: '2026-03-29' });
    });
});

// #1252: extracted from CompetitionDetailPage's eventTrailSlugs memo, which collects every distinct
// trail backing the event-detail map's polylines. Round 1 of #1250 silently dropped the edition-level
// trailSlug tier — a single-trail event linked only at edition level (no per-race trailSlug) rendered
// zero polylines — caught only by manual trace against GetEventQuery, not a test. These cases pin
// down exactly that tier alongside the race-level one.
function makeRace(trailSlug: string | null): { trailSlug: string | null } {
    return { trailSlug };
}

describe('deriveEventTrailSlugs', () => {
    it('resolves the edition-level trailSlug when no race has one', () => {
        const primaryEdition = { trailSlug: 'edition-trail', visibleRaces: [makeRace(null), makeRace(null)] };
        expect(deriveEventTrailSlugs(primaryEdition, [])).toEqual(new Set(['edition-trail']));
    });

    it('resolves the union of race-level trailSlugs when the edition itself has none', () => {
        const primaryEdition = { trailSlug: null, visibleRaces: [makeRace('race-a'), makeRace('race-b')] };
        expect(deriveEventTrailSlugs(primaryEdition, [])).toEqual(new Set(['race-a', 'race-b']));
    });

    it('resolves the union of the edition-level slug and race-level slugs when both are present', () => {
        const primaryEdition = { trailSlug: 'edition-trail', visibleRaces: [makeRace('race-a'), makeRace('race-b')] };
        expect(deriveEventTrailSlugs(primaryEdition, [])).toEqual(new Set(['edition-trail', 'race-a', 'race-b']));
    });

    it('falls back to the broader visibleRaces when primaryEdition has no races with a trailSlug', () => {
        const primaryEdition = { trailSlug: null, visibleRaces: [makeRace(null)] };
        const visibleRaces = [makeRace('fallback-race')];
        expect(deriveEventTrailSlugs(primaryEdition, visibleRaces)).toEqual(new Set(['fallback-race']));
    });

    it('returns an empty set when primaryEdition is null/undefined and visibleRaces has no trailSlugs', () => {
        expect(deriveEventTrailSlugs(null, [makeRace(null)])).toEqual(new Set());
        expect(deriveEventTrailSlugs(undefined, [])).toEqual(new Set());
    });
});

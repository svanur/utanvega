import { describe, it, expect } from 'vitest';
import { addDays, computeRaceDayFlags, daysBetween, deriveEventTrailSlugs, filterRowsByWeekRange, flattenEventRows, formatYearRanges, getCountdownLabel, getEditionTimingStatus, getRowDaysUntil, getWeekRange, isOngoingPastDayTwo, isRaceHappeningToday, msUntilNextMidnight, resolveEditionDayProgress, resolveHeroDaysUntil, resolveSeriesClimateDate, shortestUniqueEditionKey, sortByRecentlyCompletedDate, toDateOnlyString } from './eventUtils';
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

// #1308: EventTableView's series-race-row and plain-event-row chips, plus EventMapView's popup
// chip, each hand-rolled this exact daysUntil ternary rather than calling getCountdownLabel
// (already used by RacesPage, CompetitionDetailPage, AssociatedEventBanner) — the drift already
// caused a real bug once (#1307, a missing "yesterday" branch in one of the copies). These cases
// pin the key/interpolation for every branch so a future edit can't silently drop one again.
describe('getCountdownLabel', () => {
    const t = (key: string, opts?: Record<string, unknown>) => opts ? `${key}:${JSON.stringify(opts)}` : key;

    it('returns races.noDate for null', () => {
        expect(getCountdownLabel(null, t)).toBe('races.noDate');
    });

    it('returns races.today for 0', () => {
        expect(getCountdownLabel(0, t)).toBe('races.today');
    });

    it('returns races.tomorrow for 1', () => {
        expect(getCountdownLabel(1, t)).toBe('races.tomorrow');
    });

    it('returns races.yesterday for -1', () => {
        expect(getCountdownLabel(-1, t)).toBe('races.yesterday');
    });

    it('returns races.daysAgo with the absolute count for -2', () => {
        expect(getCountdownLabel(-2, t)).toBe('races.daysAgo:{"count":2}');
    });

    it('returns races.daysUntil with the count for 5', () => {
        expect(getCountdownLabel(5, t)).toBe('races.daysUntil:{"count":5}');
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

    // #1248: with seriesRaces empty/null, the season-level "event" fallback row and the
    // recentlyCompletedSeriesRace "series-race" row both described this same event in the same
    // render pass — EventTableView's includeRecentlyCompleted:true rendered it twice. The
    // series-race row alone represents the event here, so the fallback must be suppressed.
    it('renders exactly one series-race row (no duplicate event row) when seriesRaces is empty and recentlyCompletedSeriesRace is set', () => {
        const recentRace = makeSeriesRace({ raceId: 'recent', dateOfRace: '2026-10-08' });
        const event = makeEvent({ type: 'Series', seriesRaces: null, recentlyCompletedSeriesRace: recentRace });
        const rows = flattenEventRows([event], true);
        expect(rows).toEqual([
            { kind: 'series-race', event, race: recentRace, rowDate: '2026-10-08' },
        ]);
    });

    it('renders exactly one series-race row when seriesRaces is an explicit empty array and recentlyCompletedSeriesRace is set', () => {
        const recentRace = makeSeriesRace({ raceId: 'recent', dateOfRace: '2026-10-08' });
        const event = makeEvent({ type: 'Series', seriesRaces: [], recentlyCompletedSeriesRace: recentRace });
        const rows = flattenEventRows([event], true);
        expect(rows).toEqual([
            { kind: 'series-race', event, race: recentRace, rowDate: '2026-10-08' },
        ]);
    });

    // recentlyCompletedSeriesRace is a Series-only concept in practice, but guard the non-Series
    // path explicitly so a stray value there can never suppress the plain "event" fallback row.
    it('keeps the plain event row for a non-Series event even if recentlyCompletedSeriesRace is set', () => {
        const recentRace = makeSeriesRace({ raceId: 'recent', dateOfRace: '2026-10-08' });
        const event = makeEvent({ type: 'Race', recentlyCompletedSeriesRace: recentRace });
        const rows = flattenEventRows([event], true);
        expect(rows).toEqual([{ kind: 'event', event, rowDate: event.displayDate }]);
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

// #1333: applied after flattenEventRows to narrow a Series event's exploded seriesRaces rows down
// to the ones actually in [start, end] — the event-level check (eventFilters.ts) only decides
// whether to keep the event at all, so without this second pass every race's row rendered once any
// one of them qualified (live repro: Flandrasprettur's "Next week" filter rendering all 6 Hlaup
// rows instead of just the one actually next week).
describe('filterRowsByWeekRange', () => {
    it('is a no-op when range is null', () => {
        const event = makeEvent({ type: 'Race', displayDate: '2026-06-15' });
        const rows = flattenEventRows([event]);
        expect(filterRowsByWeekRange(rows, null)).toEqual(rows);
    });

    it('discards series-race rows outside the range, keeping only the one(s) inside it', () => {
        const inRange = makeSeriesRace({ raceId: 'in-range', dateOfRace: '2026-10-20' });
        const outOfRange1 = makeSeriesRace({ raceId: 'out-1', dateOfRace: '2026-11-17' });
        const outOfRange2 = makeSeriesRace({ raceId: 'out-2', dateOfRace: '2027-03-16' });
        const event = makeEvent({ type: 'Series', seriesRaces: [inRange, outOfRange1, outOfRange2] });
        const rows = flattenEventRows([event]);
        const result = filterRowsByWeekRange(rows, { start: '2026-10-19', end: '2026-10-25' });
        expect(result).toEqual([{ kind: 'series-race', event, race: inRange, rowDate: '2026-10-20' }]);
    });

    // False-negative regression: a series-race row later in the list can be the one inside range
    // even though the series's earliest/next race is outside it — row-level filtering must not
    // assume the in-range race is always first.
    it('keeps a later series-race row inside range even when the earlier one is outside it', () => {
        const outOfRange = makeSeriesRace({ raceId: 'next', dateOfRace: '2026-10-01' });
        const laterInRange = makeSeriesRace({ raceId: 'later', dateOfRace: '2026-10-22' });
        const event = makeEvent({ type: 'Series', seriesRaces: [outOfRange, laterInRange] });
        const rows = flattenEventRows([event]);
        const result = filterRowsByWeekRange(rows, { start: '2026-10-19', end: '2026-10-25' });
        expect(result).toEqual([{ kind: 'series-race', event, race: laterInRange, rowDate: '2026-10-22' }]);
    });

    it('keeps a non-Series event row when its rowDate is inside range, drops it when outside', () => {
        const inRange = makeEvent({ slug: 'in', type: 'Race', displayDate: '2026-10-20' });
        const outOfRange = makeEvent({ slug: 'out', type: 'Race', displayDate: '2026-11-01' });
        const rows = flattenEventRows([inRange, outOfRange]);
        const result = filterRowsByWeekRange(rows, { start: '2026-10-19', end: '2026-10-25' });
        expect(result.map(r => r.event.slug)).toEqual(['in']);
    });

    it('discards a row with a null rowDate', () => {
        const event = makeEvent({ type: 'Race', displayDate: null, nextEditionDate: null });
        const rows = flattenEventRows([event]);
        expect(filterRowsByWeekRange(rows, { start: '2026-10-19', end: '2026-10-25' })).toEqual([]);
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

// #1305/#1311: extracted from RacesPage's justRaced memo — re-sorts the combined "Nýlokið" list
// (plain recently-completed events + Series events carrying a recentlyCompletedSeriesRace) oldest-
// first by actual completion date, since both inputs otherwise inherit sortedFiltered's *upcoming*
// order (date/distance/name), which has nothing to do with how recently each actually finished.
describe('sortByRecentlyCompletedDate', () => {
    it('sorts ascending by displayDate when both events resolve a plain date', () => {
        const older = makeEvent({ slug: 'older', displayDate: '2026-03-10' });
        const newer = makeEvent({ slug: 'newer', displayDate: '2026-03-14' });
        expect(sortByRecentlyCompletedDate([newer, older])).toEqual([older, newer]);
    });

    it('sorts an event with neither recentlyCompletedSeriesRace.dateOfRace nor displayDate last', () => {
        const dateless = makeEvent({ slug: 'dateless', displayDate: null, recentlyCompletedSeriesRace: null });
        const dated = makeEvent({ slug: 'dated', displayDate: '2026-03-10' });
        expect(sortByRecentlyCompletedDate([dateless, dated])).toEqual([dated, dateless]);
    });

    it('sorts plain recently-completed events together with Series events by actual race date, preferring recentlyCompletedSeriesRace.dateOfRace over displayDate', () => {
        // #1244: a Series event's own displayDate/daysUntil stay edition-level (can even read as
        // upcoming) while recentlyCompletedSeriesRace.dateOfRace is the one that actually just
        // happened — this must be the field compared, not the season-level displayDate.
        const plainOld = makeEvent({ slug: 'plain-old', displayDate: '2026-03-08' });
        const seriesRecent = makeEvent({
            slug: 'series-recent',
            type: 'Series',
            displayDate: '2099-01-01', // deliberately far off / "upcoming" — must be ignored
            recentlyCompletedSeriesRace: makeSeriesRace({ dateOfRace: '2026-03-09' }),
        });
        const plainNew = makeEvent({ slug: 'plain-new', displayDate: '2026-03-11' });
        const result = sortByRecentlyCompletedDate([plainNew, plainOld, seriesRecent]);
        expect(result.map(e => e.slug)).toEqual(['plain-old', 'series-recent', 'plain-new']);
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

// #1325: isOngoingPastDayTwo previously read `new Date()` internally instead of taking an
// injectable `now` like every other function in this file — these cases isolate its own boundary
// behavior directly, rather than only indirectly via computeRaceDayFlags's non-Series tests.
describe('isOngoingPastDayTwo', () => {
    it('is false whenever daysUntil is not 0, regardless of display dates', () => {
        const now = new Date('2026-11-14T09:00:00');
        expect(isOngoingPastDayTwo(1, '2026-11-12', '2026-11-15', now)).toBe(false);
        expect(isOngoingPastDayTwo(-1, '2026-11-12', '2026-11-15', now)).toBe(false);
        expect(isOngoingPastDayTwo(null, '2026-11-12', '2026-11-15', now)).toBe(false);
    });

    it('is false when displayDate or endDisplayDate is missing', () => {
        const now = new Date('2026-11-14T09:00:00');
        expect(isOngoingPastDayTwo(0, null, '2026-11-15', now)).toBe(false);
        expect(isOngoingPastDayTwo(0, '2026-11-12', null, now)).toBe(false);
        expect(isOngoingPastDayTwo(0, '2026-11-12', undefined, now)).toBe(false);
    });

    it('is false for a single-day edition, where endDisplayDate equals displayDate', () => {
        const now = new Date('2026-11-14T09:00:00');
        expect(isOngoingPastDayTwo(0, '2026-11-12', '2026-11-12', now)).toBe(false);
    });

    it('is false on day 0 (the edition\'s own start date)', () => {
        const now = new Date('2026-11-12T09:00:00');
        expect(isOngoingPastDayTwo(0, '2026-11-12', '2026-11-15', now)).toBe(false);
    });

    it('is false on day 1 elapsed (still "just started")', () => {
        const now = new Date('2026-11-13T09:00:00');
        expect(isOngoingPastDayTwo(0, '2026-11-12', '2026-11-15', now)).toBe(false);
    });

    it('is true on day 2 elapsed', () => {
        const now = new Date('2026-11-14T09:00:00');
        expect(isOngoingPastDayTwo(0, '2026-11-12', '2026-11-15', now)).toBe(true);
    });

    it('is true past day 2, for as long as the edition keeps daysUntil pinned to 0', () => {
        const now = new Date('2026-11-15T09:00:00');
        expect(isOngoingPastDayTwo(0, '2026-11-12', '2026-11-15', now)).toBe(true);
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

// #1319: a Series event's daysUntil is pinned to 0 for its entire ongoing season span (e.g.
// Powerade Vetrarhlaupin's Oct–Mar season, one race/month) — isRaceDay/isRaceWeek must read the
// event's actual per-race dates instead for Series, or every day of the season falsely reads as
// "race day". Non-Series behavior must stay exactly as before (daysUntil-based), with the #613
// isOngoingPastDayTwo threshold now actually applied to isRaceDay, the extension #613/#618 deferred
// to this issue.
//
// #1319 follow-up: raceDates — not event.nextEditionDate — is the Series source of truth, because
// GetEventQuery.cs derives nextEditionDate from the edition's raw, intentionally-stale stored Date
// column (see computeRaceDayFlags's comment) rather than deriving it live from race dates the way
// GetEventsQuery.cs/GetAllEventDetailsQuery.cs do. These tests exercise raceDates directly instead.
describe('computeRaceDayFlags', () => {
    describe('Series events', () => {
        it('is not race day/week when every race date is far outside the window, even with daysUntil pinned to 0 (the Powerade false-positive)', () => {
            const now = new Date('2026-10-20T00:00:00');
            const result = computeRaceDayFlags(
                { type: 'Series', daysUntil: 0, raceDates: ['2026-09-14', '2026-11-12'], displayDate: '2026-10-08', endDisplayDate: '2027-03-11' },
                now,
            );
            expect(result).toEqual({ isRaceDay: false, isRaceWeek: false });
        });

        it('is race day and race week when a race date is exactly today', () => {
            const now = new Date('2026-11-12T00:00:00');
            const result = computeRaceDayFlags(
                { type: 'Series', daysUntil: 0, raceDates: ['2026-09-14', '2026-11-12'], displayDate: '2026-10-08', endDisplayDate: '2027-03-11' },
                now,
            );
            expect(result).toEqual({ isRaceDay: true, isRaceWeek: true });
        });

        it('is race week but not race day when the nearest race date is within 7 days', () => {
            const now = new Date('2026-11-07T00:00:00');
            const result = computeRaceDayFlags(
                { type: 'Series', daysUntil: 0, raceDates: ['2026-09-14', '2026-11-12'], displayDate: '2026-10-08', endDisplayDate: '2027-03-11' },
                now,
            );
            expect(result).toEqual({ isRaceDay: false, isRaceWeek: true });
        });

        it('is neither race day nor race week when there is no upcoming race at all', () => {
            const now = new Date('2026-11-07T00:00:00');
            const result = computeRaceDayFlags(
                { type: 'Series', daysUntil: null, raceDates: [], displayDate: null, endDisplayDate: null },
                now,
            );
            expect(result).toEqual({ isRaceDay: false, isRaceWeek: false });
        });

        // The regression this follow-up guards against: event.nextEditionDate reading as today's
        // date would previously have reported race day via nextEditionDate even when none of the
        // event's actual races are dated today — raceDates must be the only thing consulted now.
        it('is not race day when only a past race date is supplied, even if a stale nextEditionDate would have matched today', () => {
            const now = new Date('2026-11-12T00:00:00');
            const result = computeRaceDayFlags(
                { type: 'Series', daysUntil: 0, raceDates: ['2026-09-14'], displayDate: '2026-10-08', endDisplayDate: '2027-03-11' },
                now,
            );
            expect(result).toEqual({ isRaceDay: false, isRaceWeek: false });
        });
    });

    describe('non-Series events', () => {
        it('is race day and race week for a single-day event on its actual race day (daysUntil 0, unchanged behavior)', () => {
            const result = computeRaceDayFlags(
                { type: 'Race', daysUntil: 0, raceDates: [], displayDate: '2026-11-12', endDisplayDate: '2026-11-12' },
            );
            expect(result).toEqual({ isRaceDay: true, isRaceWeek: true });
        });

        it('is race week without being race day for daysUntil within 1–7', () => {
            const result = computeRaceDayFlags(
                { type: 'Race', daysUntil: 5, raceDates: [], displayDate: '2026-11-17', endDisplayDate: '2026-11-17' },
            );
            expect(result).toEqual({ isRaceDay: false, isRaceWeek: true });
        });

        it('is neither for a null daysUntil', () => {
            const result = computeRaceDayFlags(
                { type: 'Race', daysUntil: null, raceDates: [], displayDate: null, endDisplayDate: null },
            );
            expect(result).toEqual({ isRaceDay: false, isRaceWeek: false });
        });

        // isOngoingPastDayTwo compares its own internal "today" against displayDate using the real
        // clock (it has no injectable `now`), so these three use dates relative to the actual
        // current moment rather than a fixed, arbitrary calendar date.
        it('is still race day on day 1 of a multi-day non-Series edition', () => {
            const todayStr = toDateOnlyString(new Date());
            const result = computeRaceDayFlags(
                { type: 'Race', daysUntil: 0, raceDates: [], displayDate: todayStr, endDisplayDate: toDateOnlyString(addDays(new Date(), 5)) },
            );
            expect(result.isRaceDay).toBe(true);
        });

        it('is still race day on day 2 of a multi-day non-Series edition', () => {
            const dayTwoStr = toDateOnlyString(addDays(new Date(), -1));
            const result = computeRaceDayFlags(
                { type: 'Race', daysUntil: 0, raceDates: [], displayDate: dayTwoStr, endDisplayDate: toDateOnlyString(addDays(new Date(), 4)) },
            );
            expect(result.isRaceDay).toBe(true);
        });

        it('is no longer race day past day 2 of a multi-day non-Series edition (#613\'s deferred threshold, now applied)', () => {
            const dayThreeStr = toDateOnlyString(addDays(new Date(), -2));
            const result = computeRaceDayFlags(
                { type: 'Race', daysUntil: 0, raceDates: [], displayDate: dayThreeStr, endDisplayDate: toDateOnlyString(addDays(new Date(), 3)) },
            );
            expect(result.isRaceDay).toBe(false);
        });
    });
});

describe('resolveSeriesClimateDate', () => {
    it('returns null for an empty raceDates list (a brand-new Series edition with no races yet)', () => {
        expect(resolveSeriesClimateDate([], new Date('2026-11-07T00:00:00'))).toBeNull();
    });

    it('prefers the nearest upcoming race date over a later one', () => {
        const now = new Date('2026-11-07T00:00:00');
        expect(resolveSeriesClimateDate(['2026-12-12', '2026-11-12', '2027-01-15'], now)).toBe('2026-11-12');
    });

    it('treats today itself as upcoming (not past)', () => {
        const now = new Date('2026-11-12T00:00:00');
        expect(resolveSeriesClimateDate(['2026-09-14', '2026-11-12'], now)).toBe('2026-11-12');
    });

    it('falls back to the most recently passed race once the whole season is over', () => {
        const now = new Date('2027-04-01T00:00:00');
        expect(resolveSeriesClimateDate(['2026-10-10', '2026-11-12', '2027-03-11'], now)).toBe('2027-03-11');
    });

    // The regression this guards against: Powerade Vetrarhlaupin's Oct-Mar season reading its
    // displayDate as October (the season's min(raceDates)) for the whole ongoing span — climate
    // in February must resolve to February's own race, not October's.
    it('resolves to the in-season upcoming race, not the season\'s first race', () => {
        const now = new Date('2027-02-20T00:00:00');
        const powerade = ['2026-10-08', '2026-11-12', '2026-12-10', '2027-01-14', '2027-02-25', '2027-03-11'];
        expect(resolveSeriesClimateDate(powerade, now)).toBe('2027-02-25');
    });
});

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

// #1357: CompetitionDetailPage's hero pill, mid-season, must not read the backend-pinned
// event.daysUntil (0 for the whole Series season) as "Today" — it should derive a real countdown
// from the nearest individual race date, same resolution resolveSeriesClimateDate already uses.
describe('resolveHeroDaysUntil', () => {
    it('returns the real days-until the nearest upcoming race for a Series event mid-season (not 0)', () => {
        const now = new Date('2026-11-07T00:00:00');
        const powerade = ['2026-09-14', '2026-11-12', '2027-01-14'];
        expect(resolveHeroDaysUntil({ type: 'Series', daysUntil: 0 }, powerade, now)).toBe(5);
    });

    it('returns 0 when a Series race date is exactly today', () => {
        const now = new Date('2026-11-12T00:00:00');
        expect(resolveHeroDaysUntil({ type: 'Series', daysUntil: 0 }, ['2026-09-14', '2026-11-12'], now)).toBe(0);
    });

    it('returns null for a Series event with no race dates at all', () => {
        expect(resolveHeroDaysUntil({ type: 'Series', daysUntil: 0 }, [], new Date('2026-11-07T00:00:00'))).toBeNull();
    });

    it('passes a non-Series event\'s daysUntil through unchanged', () => {
        expect(resolveHeroDaysUntil({ type: 'Race', daysUntil: 3 }, [], new Date('2026-11-07T00:00:00'))).toBe(3);
    });
});

// #1357: EditionMeta's "Day X of Y" chip must never compute/render for a Series edition — its
// date/endDate span the whole season (derived from min/max race date on the backend), not a
// continuous multi-day event.
describe('resolveEditionDayProgress', () => {
    it('returns null for a Series edition even when today falls within its season-spanning date/endDate', () => {
        const now = new Date('2026-11-07T00:00:00');
        expect(resolveEditionDayProgress(true, '2026-09-14', '2027-03-11', now)).toBeNull();
    });

    it('still computes the day/total for a genuine (non-Series) multi-day edition currently in progress', () => {
        const now = new Date('2026-03-16T00:00:00');
        expect(resolveEditionDayProgress(false, '2026-03-14', '2026-03-18', now)).toEqual({ day: 3, totalDays: 5 });
    });
});

// #1357: a race only counts as "happening today" — and so only it may show the 'in-progress'
// chip/green border — when either the edition isn't a multi-day/Series span, or this specific
// race's own dateOfRace matches today. Mirrors the compound condition the race progress bar
// already applies, extended to racePhase/pastStart.
describe('isRaceHappeningToday', () => {
    it('is true for a single-day, non-multi-day race on its actual race day (unchanged behavior)', () => {
        const now = new Date('2026-11-12T00:00:00');
        expect(isRaceHappeningToday(0, false, '2026-11-12', now)).toBe(true);
    });

    it('is false for a single-day race when daysUntil is not 0', () => {
        const now = new Date('2026-11-12T00:00:00');
        expect(isRaceHappeningToday(1, false, '2026-11-13', now)).toBe(false);
    });

    it('is true for the one stage of a genuine multi-day edition whose dateOfRace is today', () => {
        const now = new Date('2026-03-16T00:00:00');
        expect(isRaceHappeningToday(0, true, '2026-03-16', now)).toBe(true);
    });

    it('is false for a past stage of a genuine multi-day edition even though daysUntil is still pinned to 0', () => {
        const now = new Date('2026-03-17T00:00:00');
        expect(isRaceHappeningToday(0, true, '2026-03-15', now)).toBe(false);
    });

    // The exact Series mid-season regression: daysUntil stays pinned to 0 for the whole season,
    // so a past race in the same edition must not read as "today" just because of that pinning.
    it('is false for a past Series race mid-season even though daysUntil is pinned to 0 for the whole season', () => {
        const now = new Date('2026-11-07T00:00:00');
        expect(isRaceHappeningToday(0, true, '2026-09-14', now)).toBe(false);
    });

    it('is true for the specific Series race whose dateOfRace is today', () => {
        const now = new Date('2026-11-12T00:00:00');
        expect(isRaceHappeningToday(0, true, '2026-11-12', now)).toBe(true);
    });

    it('is false for a future Series race not yet reached, even with daysUntil pinned to 0', () => {
        const now = new Date('2026-11-07T00:00:00');
        expect(isRaceHappeningToday(0, true, '2027-01-14', now)).toBe(false);
    });
});

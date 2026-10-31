import { describe, it, expect } from 'vitest';
import { applyFilters, eventFiltersEqual, eventHasMonthInSet, eventMonths, matchesDistanceBucket, parseDistanceKm, type EventFilters } from './eventFilters';
import { getWeekRange } from './eventUtils';
import type { EventSummary, SeriesRaceDto } from '../hooks/useEvents';

const DEFAULT_FILTERS: EventFilters = {
    activityTypes: [],
    months: [],
    locations: [],
    itraAny: false,
    itraPoints: [],
    certifications: [],
    championships: [],
    weekendOnly: false,
    thisWeekOnly: false,
    nextWeekOnly: false,
    mountainRaceOnly: false,
    favoritesOnly: false,
    distanceBuckets: [],
    confirmedDateOnly: false,
};

// Minimal EventSummary factory — only the fields applyFilters actually reads are meaningful,
// the rest are filled with harmless defaults so callers only override what a test cares about.
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
        trailElevationGain: null,
        ticketStatus: 'Available',
        registrationUrl: null,
        ...overrides,
    };
}

// #985: default event search to upcoming-only; `includeAllEvents` is the explicit escape hatch.
describe('applyFilters — #985 future-only-while-searching gate', () => {
    it('excludes past-dated matches while searching and includeAllEvents is false', () => {
        const events = [
            makeEvent({ slug: 'past', name: 'Old Trail Run', daysUntil: -5 }),
            makeEvent({ slug: 'future', name: 'New Trail Run', daysUntil: 5 }),
        ];
        const result = applyFilters(events, DEFAULT_FILTERS, 'trail run', [], false);
        expect(result.map(e => e.slug)).toEqual(['future']);
    });

    it('includes past-dated matches while searching once includeAllEvents is true', () => {
        const events = [
            makeEvent({ slug: 'past', name: 'Old Trail Run', daysUntil: -5 }),
            makeEvent({ slug: 'future', name: 'New Trail Run', daysUntil: 5 }),
        ];
        const result = applyFilters(events, DEFAULT_FILTERS, 'trail run', [], true);
        expect(result.map(e => e.slug).sort()).toEqual(['future', 'past']);
    });
});

// #988: dateless events (no displayDate/nextEditionDate) are hidden from the default browse view.
describe('applyFilters — #988 dateless-event exclusion', () => {
    it('excludes dateless events when there is no search text', () => {
        const events = [
            makeEvent({ slug: 'dateless', daysUntil: null, displayDate: null }),
            makeEvent({ slug: 'dated', daysUntil: 10, displayDate: '2026-06-15' }),
        ];
        const result = applyFilters(events, DEFAULT_FILTERS, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['dated']);
    });

    it('does not apply the dateless exclusion while a search is active', () => {
        const events = [
            makeEvent({ slug: 'dateless', name: 'Ghost Race', daysUntil: null, displayDate: null }),
        ];
        const result = applyFilters(events, DEFAULT_FILTERS, 'ghost', [], true);
        expect(result.map(e => e.slug)).toEqual(['dateless']);
    });
});

describe('applyFilters — location filter', () => {
    it('keeps only events whose locationName is in f.locations', () => {
        const events = [
            makeEvent({ slug: 'a', locationName: 'Reykjavik' }),
            makeEvent({ slug: 'b', locationName: 'Akureyri' }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, locations: ['Akureyri'] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['b']);
    });
});

describe('applyFilters — month filter', () => {
    it('keeps only events whose displayDate falls in one of f.months', () => {
        const events = [
            makeEvent({ slug: 'june', displayDate: '2026-06-15' }),
            makeEvent({ slug: 'july', displayDate: '2026-07-15' }),
        ];
        // Date.getMonth() is 0-indexed: June = 5
        const result = applyFilters(events, { ...DEFAULT_FILTERS, months: [5] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['june']);
    });

    it('is skipped when skipMonth is true, e.g. for building the month-pills set', () => {
        const events = [
            makeEvent({ slug: 'june', displayDate: '2026-06-15' }),
            makeEvent({ slug: 'july', displayDate: '2026-07-15' }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, months: [5] }, '', [], false, true);
        expect(result.map(e => e.slug).sort()).toEqual(['july', 'june']);
    });
});

// #1427: a Series event's displayDate/nextEditionDate only ever names its season's first race, so
// the month filter must also consult seriesRaces or it false-negatives on a later month/
// false-positives every race row for the first month alone (the row-level narrowing itself is
// covered by filterRowsByMonths in eventUtils.test.ts).
describe('applyFilters — #1427 Series month filter also consults seriesRaces', () => {
    it('keeps a Series event whose displayDate is outside the selected month but a seriesRaces date is inside it', () => {
        const events = [
            makeEvent({
                slug: 'series', type: 'Series', displayDate: '2026-10-01', nextEditionDate: null,
                seriesRaces: [makeSeriesRace({ raceId: 'r1', dateOfRace: '2026-10-01' }), makeSeriesRace({ raceId: 'r2', dateOfRace: '2026-11-15' })],
            }),
        ];
        // November = 10
        const result = applyFilters(events, { ...DEFAULT_FILTERS, months: [10] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['series']);
    });

    it('drops a Series event whose displayDate and every seriesRaces date are outside the selected month', () => {
        const events = [
            makeEvent({
                slug: 'series', type: 'Series', displayDate: '2026-10-01', nextEditionDate: null,
                seriesRaces: [makeSeriesRace({ dateOfRace: '2026-10-01' })],
            }),
        ];
        // December = 11
        const result = applyFilters(events, { ...DEFAULT_FILTERS, months: [11] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual([]);
    });

    it('ignores seriesRaces for a non-Series event — only its own displayDate decides, as before', () => {
        const events = [
            makeEvent({ slug: 'race', type: 'Race', displayDate: '2026-10-01', seriesRaces: [makeSeriesRace({ dateOfRace: '2026-11-15' })] }),
        ];
        // November = 10
        const result = applyFilters(events, { ...DEFAULT_FILTERS, months: [10] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual([]);
    });
});

describe('eventHasMonthInSet', () => {
    it('matches on the event-level displayDate/nextEditionDate month alone for a non-Series event', () => {
        const event = makeEvent({ type: 'Race', displayDate: '2026-10-01' });
        expect(eventHasMonthInSet(event, [9])).toBe(true); // October = 9
        expect(eventHasMonthInSet(event, [10])).toBe(false);
    });

    it('also matches a Series event via any seriesRaces date', () => {
        const event = makeEvent({
            type: 'Series', displayDate: '2026-10-01', nextEditionDate: null,
            seriesRaces: [makeSeriesRace({ raceId: 'r1', dateOfRace: '2026-10-01' }), makeSeriesRace({ raceId: 'r2', dateOfRace: '2026-12-01' })],
        });
        expect(eventHasMonthInSet(event, [11])).toBe(true); // December = 11
    });

    it('returns false for a Series event with no matching date at all', () => {
        const event = makeEvent({
            type: 'Series', displayDate: '2026-10-01', nextEditionDate: null,
            seriesRaces: [makeSeriesRace({ dateOfRace: '2026-10-01' })],
        });
        expect(eventHasMonthInSet(event, [11])).toBe(false);
    });

    it('returns false when there is no date at all to check', () => {
        const event = makeEvent({ displayDate: null, nextEditionDate: null });
        expect(eventHasMonthInSet(event, [0])).toBe(false);
    });
});

// #1427: powers RacesPage's monthsWithEvents, which gates which month chips render at all —
// under-collecting here (the pre-fix bug) makes eventHasMonthInSet/filterRowsByMonths unreachable
// from the real UI for a later-month Series race, since its chip would never render to begin with.
describe('eventMonths', () => {
    it('returns only the event-level displayDate/nextEditionDate month for a non-Series event', () => {
        const event = makeEvent({ type: 'Race', displayDate: '2026-10-01' });
        expect(eventMonths(event)).toEqual([9]); // October = 9
    });

    it('collects every distinct seriesRaces month for a Series event, including months its own displayDate never names', () => {
        const event = makeEvent({
            type: 'Series', displayDate: '2026-10-01', nextEditionDate: null,
            seriesRaces: [
                makeSeriesRace({ raceId: 'oct', dateOfRace: '2026-10-01' }),
                makeSeriesRace({ raceId: 'nov', dateOfRace: '2026-11-15' }),
                makeSeriesRace({ raceId: 'dec', dateOfRace: '2026-12-15' }),
            ],
        });
        // October = 9, November = 10, December = 11
        expect(eventMonths(event).sort((a, b) => a - b)).toEqual([9, 10, 11]);
    });

    it('does not duplicate a month shared by displayDate and a seriesRaces date', () => {
        const event = makeEvent({
            type: 'Series', displayDate: '2026-10-01', nextEditionDate: null,
            seriesRaces: [makeSeriesRace({ dateOfRace: '2026-10-20' })],
        });
        expect(eventMonths(event)).toEqual([9]); // October = 9
    });

    it('returns an empty array when there is no date at all', () => {
        const event = makeEvent({ displayDate: null, nextEditionDate: null });
        expect(eventMonths(event)).toEqual([]);
    });
});

describe('applyFilters — activity type filter', () => {
    it('keeps only events whose activityType is in f.activityTypes', () => {
        const events = [
            makeEvent({ slug: 'run', activityType: 'Running' }),
            makeEvent({ slug: 'trail', activityType: 'TrailRunning' }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, activityTypes: ['TrailRunning'] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['trail']);
    });
});

describe('applyFilters — ITRA filter', () => {
    it('itraAny keeps only events with at least one ITRA point value', () => {
        const events = [
            makeEvent({ slug: 'with-itra', itraPoints: [3] }),
            makeEvent({ slug: 'without-itra', itraPoints: null }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, itraAny: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['with-itra']);
    });

    it('itraPoints keeps only events overlapping the selected point values', () => {
        const events = [
            makeEvent({ slug: 'match', itraPoints: [4] }),
            makeEvent({ slug: 'no-match', itraPoints: [1] }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, itraPoints: [4, 5] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['match']);
    });
});

describe('applyFilters — certification filter', () => {
    it('keeps only events with at least one matching certification', () => {
        const events = [
            makeEvent({ slug: 'certified', certifications: ['UTMB Index'] }),
            makeEvent({ slug: 'uncertified', certifications: null }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, certifications: ['UTMB Index'] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['certified']);
    });
});

describe('applyFilters — championship filter', () => {
    it('keeps only events with at least one matching championship category', () => {
        const events = [
            makeEvent({ slug: 'champ', championshipCategories: ['Iceland Championship'] }),
            makeEvent({ slug: 'non-champ', championshipCategories: null }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, championships: ['Iceland Championship'] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['champ']);
    });
});

describe('applyFilters — weekend/this-week/next-week filters', () => {
    it('weekendOnly keeps only Saturday/Sunday-dated events', () => {
        const events = [
            makeEvent({ slug: 'saturday', displayDate: '2026-03-14' }), // Saturday
            makeEvent({ slug: 'tuesday', displayDate: '2026-03-10' }), // Tuesday
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, weekendOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['saturday']);
    });

    it('thisWeekOnly delegates to getWeekRange("this") relative to real "now"', () => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const events = [
            makeEvent({ slug: 'today', displayDate: todayStr }),
            makeEvent({ slug: 'far-future', displayDate: '2099-01-01' }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, thisWeekOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['today']);
    });

    it('nextWeekOnly excludes an event dated in the current week', () => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const events = [
            makeEvent({ slug: 'today', displayDate: todayStr }),
            makeEvent({ slug: 'far-future', displayDate: '2099-01-01' }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, nextWeekOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual([]);
    });
});

// #1333: a Series event's displayDate/nextEditionDate only ever names its *next* race, so the
// event-level thisWeekOnly/nextWeekOnly check must also consult seriesRaces or it false-negatives
// on a series whose soonest race already missed the target week while a later race in the same
// series lands inside it.
describe('applyFilters — #1333 Series week filters also consult seriesRaces', () => {
    it('keeps a Series event whose nextEditionDate is outside next week but a later seriesRaces date is inside it (false-negative regression)', () => {
        const { start } = getWeekRange('next');
        const events = [
            makeEvent({
                slug: 'series', type: 'Series', displayDate: null, nextEditionDate: '2099-01-01',
                seriesRaces: [makeSeriesRace({ raceId: 'r1', dateOfRace: '2099-01-01' }), makeSeriesRace({ raceId: 'r2', dateOfRace: start })],
            }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, nextWeekOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['series']);
    });

    it('drops a Series event whose nextEditionDate and every seriesRaces date are outside next week', () => {
        const events = [
            makeEvent({
                slug: 'series', type: 'Series', displayDate: null, nextEditionDate: '2099-01-01',
                seriesRaces: [makeSeriesRace({ dateOfRace: '2099-02-01' })],
            }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, nextWeekOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual([]);
    });

    it('ignores seriesRaces for a non-Series event — only its own displayDate decides, as before', () => {
        const { start } = getWeekRange('next');
        const events = [
            makeEvent({ slug: 'race', type: 'Race', displayDate: '2099-01-01', seriesRaces: [makeSeriesRace({ dateOfRace: start })] }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, nextWeekOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual([]);
    });

    it('applies the same seriesRaces check to thisWeekOnly', () => {
        const { start } = getWeekRange('this');
        const events = [
            makeEvent({
                slug: 'series', type: 'Series', displayDate: null, nextEditionDate: '2099-01-01',
                seriesRaces: [makeSeriesRace({ dateOfRace: start })],
            }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, thisWeekOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['series']);
    });
});

describe('applyFilters — mountain race filter', () => {
    it('keeps only events flagged isMountainRace', () => {
        const events = [
            makeEvent({ slug: 'mountain', isMountainRace: true }),
            makeEvent({ slug: 'flat', isMountainRace: false }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, mountainRaceOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['mountain']);
    });
});

// #1588: "Confirmed date only" keeps events whose server-computed edition status is a
// confirmed, non-cancelled date — see the confirmedDateOnly predicate in eventFilters.ts.
describe('applyFilters — confirmed date only filter', () => {
    it('excludes an Unconfirmed event', () => {
        const events = [
            makeEvent({ slug: 'unconfirmed', editionStatus: 'Unconfirmed', editionEffectiveCancelled: false }),
            makeEvent({ slug: 'active', editionStatus: 'Active', editionEffectiveCancelled: false }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, confirmedDateOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['active']);
    });

    it('excludes an Active event that has since been effectively cancelled', () => {
        const events = [
            makeEvent({ slug: 'cancelled', editionStatus: 'Active', editionEffectiveCancelled: true }),
            makeEvent({ slug: 'active', editionStatus: 'Active', editionEffectiveCancelled: false }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, confirmedDateOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['active']);
    });

    it('includes an Active, non-cancelled event', () => {
        const events = [
            makeEvent({ slug: 'active', editionStatus: 'Active', editionEffectiveCancelled: false }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, confirmedDateOnly: true }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['active']);
    });
});

describe('applyFilters — favorites filter', () => {
    it('keeps only events whose slug is in the favoriteEvents parameter', () => {
        const events = [
            makeEvent({ slug: 'fav-race' }),
            makeEvent({ slug: 'other-race' }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, favoritesOnly: true }, '', ['fav-race'], false);
        expect(result.map(e => e.slug)).toEqual(['fav-race']);
    });
});

describe('applyFilters — distance bucket filter', () => {
    it('keeps only events with at least one distance falling in a selected bucket', () => {
        const events = [
            makeEvent({ slug: 'marathon', distances: [{ label: '42km', ticketStatus: null }] }),
            makeEvent({ slug: 'fun-run', distances: [{ label: '5km', ticketStatus: null }] }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, distanceBuckets: ['21-42'] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['marathon']);
    });

    it('includes events with an unparseable distance label rather than silently dropping them', () => {
        const events = [
            makeEvent({ slug: 'weird-label', distances: [{ label: 'unknown', ticketStatus: null }] }),
        ];
        const result = applyFilters(events, { ...DEFAULT_FILTERS, distanceBuckets: ['<10'] }, '', [], false);
        expect(result.map(e => e.slug)).toEqual(['weird-label']);
    });
});

describe('parseDistanceKm', () => {
    it('parses a leading integer km value', () => {
        expect(parseDistanceKm('42km')).toBe(42);
    });

    it('parses a leading decimal km value using either separator', () => {
        expect(parseDistanceKm('21.1 km')).toBe(21.1);
        expect(parseDistanceKm('21,1 km')).toBe(21.1);
    });

    it('returns null for a label with no leading number', () => {
        expect(parseDistanceKm('Fun Run')).toBeNull();
    });
});

describe('matchesDistanceBucket', () => {
    it('classifies boundary values correctly across all buckets', () => {
        expect(matchesDistanceBucket(9.9, '<10')).toBe(true);
        expect(matchesDistanceBucket(10, '<10')).toBe(false);
        expect(matchesDistanceBucket(10, '10-21')).toBe(true);
        expect(matchesDistanceBucket(21.1, '10-21')).toBe(false);
        expect(matchesDistanceBucket(21.1, '21-42')).toBe(true);
        expect(matchesDistanceBucket(42.195, '21-42')).toBe(false);
        expect(matchesDistanceBucket(42.195, '42-100')).toBe(true);
        expect(matchesDistanceBucket(100, '42-100')).toBe(false);
        expect(matchesDistanceBucket(100, '100+')).toBe(true);
    });
});

describe('eventFiltersEqual', () => {
    it('treats two default-shaped filter objects as equal despite different array references', () => {
        expect(eventFiltersEqual(DEFAULT_FILTERS, { ...DEFAULT_FILTERS })).toBe(true);
    });

    it('ignores array element order within each field as long as content is identical and ordered the same', () => {
        const a = { ...DEFAULT_FILTERS, activityTypes: ['TrailRunning', 'Running'] };
        const b = { ...DEFAULT_FILTERS, activityTypes: ['TrailRunning', 'Running'] };
        expect(eventFiltersEqual(a, b)).toBe(true);
    });

    it('detects a difference in a scalar boolean field', () => {
        expect(eventFiltersEqual(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, itraAny: true })).toBe(false);
    });

    it('detects a difference in array length', () => {
        const a = { ...DEFAULT_FILTERS, months: [1, 2] };
        const b = { ...DEFAULT_FILTERS, months: [1] };
        expect(eventFiltersEqual(a, b)).toBe(false);
    });

    it('detects a difference in array order', () => {
        const a = { ...DEFAULT_FILTERS, locations: ['Reykjavik', 'Akureyri'] };
        const b = { ...DEFAULT_FILTERS, locations: ['Akureyri', 'Reykjavik'] };
        expect(eventFiltersEqual(a, b)).toBe(false);
    });
});

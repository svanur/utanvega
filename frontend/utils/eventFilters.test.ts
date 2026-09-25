import { describe, it, expect } from 'vitest';
import { applyFilters, matchesDistanceBucket, parseDistanceKm, type EventFilters } from './eventFilters';
import type { EventSummary } from '../hooks/useEvents';

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
        gpxPointLat: null,
        gpxPointLng: null,
        isMountainRace: false,
        endDisplayDate: null,
        editionStatus: null,
        editionEffectiveCancelled: false,
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

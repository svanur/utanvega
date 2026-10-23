import { describe, it, expect } from 'vitest';
import { formatEventListForClipboard, formatEventListHeader, formatTrailListForClipboard, toCopyableEventRows } from './copyListToClipboard';
import type { FlattenedEventRow } from './eventUtils';
import type { EventSummary, SeriesRaceDto } from '../hooks/useEvents';

// Minimal bilingual month/weekday fixtures matching the shape of frontend/i18n/en.json and
// is.json's races.months/races.weekdaysShort arrays, so these tests don't depend on react-i18next
// actually loading a locale file.
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_IS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
const WEEKDAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_SHORT_IS = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau'];

function makeT(lang: 'en' | 'is') {
    const months = lang === 'en' ? MONTHS_EN : MONTHS_IS;
    const weekdaysShort = lang === 'en' ? WEEKDAYS_SHORT_EN : WEEKDAYS_SHORT_IS;
    const noDate = lang === 'en' ? 'Date TBD' : 'Dagsetning óákveðin';
    return (key: string) => {
        if (key === 'races.months') return months as unknown as string;
        if (key === 'races.weekdaysShort') return weekdaysShort as unknown as string;
        if (key === 'races.noDate') return noDate;
        return key;
    };
}

// Mirrors the factory in eventUtils.test.ts — only the fields toCopyableEventRows actually reads
// are meaningful.
function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
    return {
        id: 'event-1',
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

const locIs = (is: string | null | undefined, en: string | null | undefined) => is ?? en ?? null;
const locEn = (is: string | null | undefined, en: string | null | undefined) => (en ?? is ?? null);

describe('formatEventListHeader', () => {
    it('returns empty string for no dates', () => {
        expect(formatEventListHeader([], makeT('is'))).toBe('');
    });

    it('formats a single date without a dash', () => {
        expect(formatEventListHeader(['2026-09-15'], makeT('is'))).toBe('15. september 2026');
    });

    it('formats a range within a single month with the month/year stated once', () => {
        expect(formatEventListHeader(['2026-09-13', '2026-09-20'], makeT('is'))).toBe('13. – 20. september 2026');
    });

    it('formats a range spanning a month boundary with both month names', () => {
        expect(formatEventListHeader(['2026-11-30', '2026-12-06'], makeT('is'))).toBe('30. nóvember – 6. desember 2026');
    });

    it('is derived from the min/max of unsorted input, not the array order', () => {
        expect(formatEventListHeader(['2026-09-20', '2026-09-13', '2026-09-16'], makeT('is'))).toBe('13. – 20. september 2026');
    });

    it('renders English month names when passed an English t function', () => {
        expect(formatEventListHeader(['2026-09-13', '2026-09-20'], makeT('en'))).toBe('13. – 20. September 2026');
    });
});

describe('toCopyableEventRows', () => {
    it('maps a plain event row to its localized name and rowDate', () => {
        const rows: FlattenedEventRow[] = [{ kind: 'event', event: makeEvent({ name: 'Hlaupahátíð', nameEn: 'Running Festival' }), rowDate: '2026-06-15' }];
        expect(toCopyableEventRows(rows, locIs)).toEqual([{ dateStr: '2026-06-15', name: 'Hlaupahátíð' }]);
        expect(toCopyableEventRows(rows, locEn)).toEqual([{ dateStr: '2026-06-15', name: 'Running Festival' }]);
    });

    // A Series event's individual races must each keep their own line, not collapse into one
    // event-level line — the event name is still carried alongside so the copied text doesn't
    // read as a bare "Race 3" with no series context.
    it('keeps the event name alongside each series-race name on its own row', () => {
        const event = makeEvent({ name: 'Powerade Vetrarhlaupin', nameEn: null, type: 'Series' });
        const rows: FlattenedEventRow[] = [
            { kind: 'series-race', event, race: makeSeriesRace({ raceId: 'r1', raceName: 'Hlaup 1', dateOfRace: '2026-10-01' }), rowDate: '2026-10-01' },
            { kind: 'series-race', event, race: makeSeriesRace({ raceId: 'r2', raceName: 'Hlaup 2', dateOfRace: '2026-11-01' }), rowDate: '2026-11-01' },
        ];
        expect(toCopyableEventRows(rows, locIs)).toEqual([
            { dateStr: '2026-10-01', name: 'Powerade Vetrarhlaupin · Hlaup 1' },
            { dateStr: '2026-11-01', name: 'Powerade Vetrarhlaupin · Hlaup 2' },
        ]);
    });
});

describe('formatEventListForClipboard', () => {
    it('returns an empty string for an empty row list', () => {
        expect(formatEventListForClipboard([], makeT('is'))).toBe('');
    });

    // #1488 review: an undated/unconfirmed row still renders as a visible card on RacesPage, so
    // it must not be silently dropped from the copied text — it has nowhere to go under a date
    // header, so it's grouped last under races.noDate instead.
    it('keeps undated rows, grouped last under races.noDate, when every row is dateless', () => {
        const text = formatEventListForClipboard([{ dateStr: null, name: 'Dateless Event' }], makeT('is'));
        expect(text).toBe(['Dagsetning óákveðin', '  • Dateless Event'].join('\n'));
    });

    it('keeps undated rows after the dated groups in a mixed dated/undated list', () => {
        const text = formatEventListForClipboard(
            [
                { dateStr: '2026-09-20', name: 'Hlaup A' },
                { dateStr: null, name: 'Óstaðfest hlaup' },
            ],
            makeT('is'),
        );
        expect(text).toBe([
            '20. september 2026',
            '',
            'Sun 20. september',
            '  • Hlaup A',
            '',
            'Dagsetning óákveðin',
            '  • Óstaðfest hlaup',
        ].join('\n'));
    });

    it('groups same-date rows under one date header, bulleted with "  • "', () => {
        const text = formatEventListForClipboard(
            [
                { dateStr: '2026-09-20', name: 'Hlaup A' },
                { dateStr: '2026-09-20', name: 'Hlaup B' },
            ],
            makeT('is'),
        );
        expect(text).toBe([
            '20. september 2026',
            '',
            'Sun 20. september',
            '  • Hlaup A',
            '  • Hlaup B',
        ].join('\n'));
    });

    it('sorts multiple dates chronologically regardless of input order and renders each on its own date line', () => {
        const text = formatEventListForClipboard(
            [
                { dateStr: '2026-11-01', name: 'Hlaup 2' },
                { dateStr: '2026-10-01', name: 'Hlaup 1' },
            ],
            makeT('is'),
        );
        expect(text).toBe([
            '1. október – 1. nóvember 2026',
            '',
            'Fim 1. október',
            '  • Hlaup 1',
            '',
            'Sun 1. nóvember',
            '  • Hlaup 2',
        ].join('\n'));
    });

    it('renders English day/month names when passed an English t function', () => {
        const text = formatEventListForClipboard([{ dateStr: '2026-09-20', name: 'Race A' }], makeT('en'));
        expect(text).toBe([
            '20. September 2026',
            '',
            'Sun 20. September',
            '  • Race A',
        ].join('\n'));
    });
});

describe('formatTrailListForClipboard', () => {
    it('returns an empty string for no rows', () => {
        expect(formatTrailListForClipboard([])).toBe('');
    });

    it('renders a flat bulleted list with no date grouping', () => {
        const text = formatTrailListForClipboard([{ name: 'Esjan' }, { name: 'Úlfarsfell' }]);
        expect(text).toBe(['• Esjan', '• Úlfarsfell'].join('\n'));
    });

    it('appends the location in parentheses when present', () => {
        const text = formatTrailListForClipboard([{ name: 'Esjan', location: 'Mosfellsbær' }, { name: 'Úlfarsfell', location: null }]);
        expect(text).toBe(['• Esjan (Mosfellsbær)', '• Úlfarsfell'].join('\n'));
    });
});

import { describe, it, expect } from 'vitest';
import {
    formatActiveFiltersSummary,
    formatEventListForClipboard,
    formatEventListHeader,
    formatListHeading,
    formatTrailListForClipboard,
    toCopyableEventRows,
} from './copyListToClipboard';
import type { ActiveFilterLine } from './copyListToClipboard';
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
    const strings: Record<string, string> = lang === 'en'
        ? { 'nav.trails': 'Trails', 'nav.events': 'Events', 'common.filtersHeading': 'Filters:' }
        : { 'nav.trails': 'Leiðir', 'nav.events': 'Hlaup', 'common.filtersHeading': 'Síur:' };
    return (key: string) => {
        if (key === 'races.months') return months as unknown as string;
        if (key === 'races.weekdaysShort') return weekdaysShort as unknown as string;
        if (key === 'races.noDate') return noDate;
        if (key in strings) return strings[key];
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
        expect(toCopyableEventRows(rows, locIs)).toEqual([{ dateStr: '2026-06-15', name: 'Hlaupahátíð', distanceLabel: null, elevationGain: null }]);
        expect(toCopyableEventRows(rows, locEn)).toEqual([{ dateStr: '2026-06-15', name: 'Running Festival', distanceLabel: null, elevationGain: null }]);
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
            { dateStr: '2026-10-01', name: 'Powerade Vetrarhlaupin · Hlaup 1', distanceLabel: null, elevationGain: null },
            { dateStr: '2026-11-01', name: 'Powerade Vetrarhlaupin · Hlaup 2', distanceLabel: null, elevationGain: null },
        ]);
    });

    // #1495: a series-race row carries SeriesRaceDto.distanceLabel directly.
    it('carries a series race\'s own distanceLabel through', () => {
        const event = makeEvent({ name: 'Powerade Vetrarhlaupin', type: 'Series' });
        const rows: FlattenedEventRow[] = [
            { kind: 'series-race', event, race: makeSeriesRace({ raceId: 'r1', raceName: 'Hlaup 1', distanceLabel: '10 km' }), rowDate: '2026-10-01' },
        ];
        expect(toCopyableEventRows(rows, locIs)[0].distanceLabel).toBe('10 km');
    });

    // #1495: SeriesRaceDto has no declared trailElevationGain field today — read defensively
    // rather than assuming it's always absent, so this starts working the moment the API sends it.
    it('reads elevationGain defensively off a series race object that does carry one', () => {
        const event = makeEvent({ name: 'Powerade Vetrarhlaupin', type: 'Series' });
        const raceWithElevation = { ...makeSeriesRace({ raceId: 'r1' }), trailElevationGain: 450 };
        const rows: FlattenedEventRow[] = [
            { kind: 'series-race', event, race: raceWithElevation, rowDate: '2026-10-01' },
        ];
        expect(toCopyableEventRows(rows, locIs)[0].elevationGain).toBe(450);
    });

    // #1495: a plain event's `distances` is an aggregate list across all of its races — only
    // unambiguous to show as "the" distance when there's exactly one entry.
    it('carries a plain event\'s single distance label through, but omits it when the event has several', () => {
        const single = makeEvent({ distances: [{ label: '21 km', ticketStatus: 'Available' }] });
        const rowsSingle: FlattenedEventRow[] = [{ kind: 'event', event: single, rowDate: '2026-06-15' }];
        expect(toCopyableEventRows(rowsSingle, locIs)[0].distanceLabel).toBe('21 km');

        const multi = makeEvent({ distances: [{ label: '21 km', ticketStatus: 'Available' }, { label: '42 km', ticketStatus: 'Available' }] });
        const rowsMulti: FlattenedEventRow[] = [{ kind: 'event', event: multi, rowDate: '2026-06-15' }];
        expect(toCopyableEventRows(rowsMulti, locIs)[0].distanceLabel).toBeNull();
    });

    it('never carries an elevationGain for a plain event row — the aggregate distances shape has no such field', () => {
        const event = makeEvent({ distances: [{ label: '21 km', ticketStatus: 'Available' }] });
        const rows: FlattenedEventRow[] = [{ kind: 'event', event, rowDate: '2026-06-15' }];
        expect(toCopyableEventRows(rows, locIs)[0].elevationGain).toBeNull();
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

    // #1495
    it('appends distance and elevation gain, " · "-separated, after the name when both are present', () => {
        const text = formatEventListForClipboard([{ dateStr: '2026-09-20', name: 'Race A', distanceLabel: '21 km', elevationGain: 450 }], makeT('is'));
        expect(text.split('\n').at(-1)).toBe('  • Race A · 21 km · 450 m');
    });

    it('omits distance or elevation individually when unavailable, without leaving a stray " · "', () => {
        const distanceOnly = formatEventListForClipboard([{ dateStr: '2026-09-20', name: 'Race A', distanceLabel: '21 km', elevationGain: null }], makeT('is'));
        expect(distanceOnly.split('\n').at(-1)).toBe('  • Race A · 21 km');

        const elevationOnly = formatEventListForClipboard([{ dateStr: '2026-09-20', name: 'Race B', distanceLabel: null, elevationGain: 300 }], makeT('is'));
        expect(elevationOnly.split('\n').at(-1)).toBe('  • Race B · 300 m');

        const neither = formatEventListForClipboard([{ dateStr: '2026-09-20', name: 'Race C' }], makeT('is'));
        expect(neither.split('\n').at(-1)).toBe('  • Race C');
    });

    // #1495: spliced in right after the date-range header, before the first day group.
    it('inserts the "Filters:" block between the date-range header and the first day group', () => {
        const text = formatEventListForClipboard(
            [{ dateStr: '2026-09-20', name: 'Race A' }],
            makeT('is'),
            ['Síur:', '  Virkni: Hlaup'],
        );
        expect(text).toBe([
            '20. september 2026',
            '',
            'Síur:',
            '  Virkni: Hlaup',
            '',
            'Sun 20. september',
            '  • Race A',
        ].join('\n'));
    });

    // #1495: when every row is dateless there's no date-range header to splice after — the
    // "Filters:" block still has to appear before the races.noDate group.
    it('inserts the "Filters:" block before the races.noDate group when every row is dateless', () => {
        const text = formatEventListForClipboard(
            [{ dateStr: null, name: 'Dateless Event' }],
            makeT('is'),
            ['Síur:', '  Virkni: Hlaup'],
        );
        expect(text).toBe([
            'Síur:',
            '  Virkni: Hlaup',
            '',
            'Dagsetning óákveðin',
            '  • Dateless Event',
        ].join('\n'));
    });

    it('omits the "Filters:" block entirely when no filter lines are passed, matching pre-#1495 output', () => {
        const text = formatEventListForClipboard([{ dateStr: '2026-09-20', name: 'Race A' }], makeT('is'), []);
        expect(text).toBe([
            '20. september 2026',
            '',
            'Sun 20. september',
            '  • Race A',
        ].join('\n'));
    });
});

describe('formatListHeading', () => {
    it('renders "{{brandName}} – Trails" for the Icelandic host', () => {
        expect(formatListHeading('trails', makeT('is'), 'hlaupadagskra.is')).toBe('Hlaupadagskra.is – Leiðir');
    });

    it('renders "{{brandName}} – Events" for the English host', () => {
        expect(formatListHeading('events', makeT('en'), '360runs.com')).toBe('360Runs – Events');
    });

    it('resolves the brand from the hostname independently of the t function\'s own language', () => {
        // English t() but an Icelandic host — brand must follow the host, not the UI language.
        expect(formatListHeading('trails', makeT('en'), 'hlaupadagskra.is')).toBe('Hlaupadagskra.is – Trails');
    });
});

describe('formatActiveFiltersSummary', () => {
    it('returns an empty array when no filter is active', () => {
        expect(formatActiveFiltersSummary([], makeT('is'))).toEqual([]);
    });

    it('renders one "  Key: Value" line per entry, under a translated "Filters:" heading', () => {
        const entries: ActiveFilterLine[] = [
            { label: 'Lengd leiðar', value: 'Hálft-Maraþon' },
            { label: 'Erfiðleiki', value: 'Auðvelt, Miðlungs' },
        ];
        expect(formatActiveFiltersSummary(entries, makeT('is'))).toEqual([
            'Síur:',
            '  Lengd leiðar: Hálft-Maraþon',
            '  Erfiðleiki: Auðvelt, Miðlungs',
        ]);
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

    // #1495
    it('appends length and elevation gain, " · "-separated, after the name/location when both are present', () => {
        const text = formatTrailListForClipboard([{ name: 'Esjan', location: 'Mosfellsbær', lengthKm: 12.3, elevationGain: 450 }]);
        expect(text).toBe('• Esjan (Mosfellsbær) · 12.3 km · 450 m');
    });

    it('rounds elevation gain to the nearest metre and formats length to one decimal', () => {
        const text = formatTrailListForClipboard([{ name: 'Úlfarsfell', lengthKm: 6.449, elevationGain: 299.6 }]);
        expect(text).toBe('• Úlfarsfell · 6.4 km · 300 m');
    });

    it('omits length or elevation individually when unavailable, without leaving a stray " · "', () => {
        const lengthOnly = formatTrailListForClipboard([{ name: 'Esjan', lengthKm: 12.3, elevationGain: null }]);
        expect(lengthOnly).toBe('• Esjan · 12.3 km');

        const elevationOnly = formatTrailListForClipboard([{ name: 'Esjan', lengthKm: null, elevationGain: 450 }]);
        expect(elevationOnly).toBe('• Esjan · 450 m');

        const neither = formatTrailListForClipboard([{ name: 'Esjan', lengthKm: null, elevationGain: null }]);
        expect(neither).toBe('• Esjan');
    });
});

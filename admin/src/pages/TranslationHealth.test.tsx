// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import TranslationHealth from './TranslationHealth';
import { hashText } from '../utils/translationHash';
import type { Trail } from '../hooks/useTrails';
import type { TagDto } from '../hooks/useTags';
import type { EventDetailDto, EventEditionDto, RaceDto } from '../hooks/useEvents';
import type { LocationDto } from '../hooks/useLocations';
import type { OrganizerDto } from '../hooks/useOrganizers';

// #1481: translateItem/translateAll used to run every missing/stale field — including the
// proper-noun "Name" field on Event/Race/Trail/Location — through the DeepL endpoint, which
// mangles names (e.g. "Súlur Vertical" -> "Vertical columns"). FieldDef.translatable (default
// true, set false on those four Name fields) now splits target fields into a DeepL group and a
// verbatim-copy group that merge into the same patch/PUT. This renders the real component end to
// end (same shape as TrailHealth.test.tsx) and asserts on the actual translate-endpoint calls and
// PUT bodies, rather than testing the split in isolation, since the behaviour that matters is what
// ends up in the saved patch.
//
// mockState is declared via vi.hoisted so it's initialized before the vi.mock factory below runs
// (vi.mock is hoisted above regular imports/consts — see EventDetailPage.test.tsx for the same
// pattern). The fixtures are mutated per test rather than redeclared so each test can adjust just
// the field(s) it cares about.
const mockState = vi.hoisted(() => ({
  trail: {
    id: 'trail-1',
    name: 'Súlur Vertical',
    nameEn: null as string | null,
    description: 'Lýsing á leiðinni',
    descriptionEn: null as string | null,
    slug: 'sulur-vertical',
    length: 10,
    elevationGain: 900,
    elevationLoss: 900,
    status: 'Published',
    activityType: 'TrailRunning',
    trailType: 'Loop',
    // #1622: GPX pin / registration windows / YouTube URL / social links fields below exist only
    // to drive the "savePatch preserves unlisted command fields" assertions further down — a
    // non-null youtubeUrl here is what lets a test prove it survives a save targeting a
    // different field.
    youtubeUrl: 'https://youtube.com/watch?v=old' as string | null,
    locations: [],
    createdAt: '2024-01-01T00:00:00Z',
    translationHashes: undefined as Record<string, string> | undefined,
  } as Trail,
  tag: {
    id: 'tag-1',
    name: 'Fjallahlaup',
    nameEn: null as string | null,
    slug: 'fjallahlaup',
    color: '#123456',
    trailCount: 3,
  } as TagDto,
  // #1582: Event/Location/Organizer PUT bodies were built without `id`, so model binding filled
  // it with Guid.Empty and the backend's `id != command.Id` guard 400'd every save. These three
  // fixtures exist only to drive the regression assertions below (body.id present) — unlike the
  // Trail/Tag fixtures above, their translation state is irrelevant to that bug.
  // nameEn/descriptionEn default to filled (not missing) so these fixtures don't inflate the
  // unrelated #1481/#1485 "Translate all missing" assertions above, which count items by kind;
  // the #1582 describe block below nulls descriptionEn itself before each of its own tests.
  event: {
    id: 'event-1',
    name: 'Hengill Ultra',
    nameEn: 'Hengill Ultra' as string | null,
    slug: 'hengill-ultra',
    description: 'Lýsing á viðburði',
    descriptionEn: 'Old English event description' as string | null,
    type: 'Race',
    activityType: 'TrailRunning',
    status: 'Active',
    organizerName: null,
    organizerNameEn: null,
    organizerWebsite: null,
    organizerId: null,
    organizerSlug: null,
    alertMessage: null,
    alertMessageEn: null,
    alertSeverity: null,
    locationId: null,
    locationName: null,
    locationType: null,
    scheduleRule: null,
    socialLinks: null,
    nextEditionDate: null,
    daysUntil: null,
    editionCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    seriesRaces: null,
    // #1622: non-null so the "saving Description leaves gpxPointLat/gpxPointLng unchanged"
    // assertion below has a real value to prove survives the save, not just two nulls staying null.
    gpxPointLat: 64.123 as number | null,
    gpxPointLng: -21.456 as number | null,
    isMountainRace: false,
    terrainType: null,
    hasFutureEdition: false,
    endDisplayDate: null,
    translationHashes: undefined as Record<string, string> | undefined,
    editionStatus: null,
    editionEffectiveCancelled: false,
    anyEditionNeedsReview: false,
    anyEditionUnconfirmed: false,
    upcomingDates: [],
    // Wired to mockState.edition/.race below (assigned after this object literal closes, since
    // mockState can't reference itself mid-initializer) so clickTranslateFor can find those rows.
    editions: [] as EventEditionDto[],
  } as EventDetailDto,
  // #1622: Edition/Race fixtures for savePatch's "preserves unlisted command fields" coverage.
  // notesEn/descriptionEn default to filled (not missing) for the same #1481/#1485 bulk-count
  // reason as the event/location/organizer fixtures above — the #1622 describe block nulls the
  // field it's testing itself, per test.
  edition: {
    id: 'edition-1',
    eventId: 'event-1',
    year: 2026,
    date: '2026-08-15',
    endDate: '2026-08-16' as string | null,
    title: 'Edition 2026',
    titleEn: 'Edition 2026' as string | null,
    registrationUrl: null,
    resultsUrl: null,
    notes: 'Athugasemdir um mótið',
    notesEn: 'Old English notes' as string | null,
    registrationStatus: 'Open',
    registrationOpens: '2026-06-01T00:00:00Z' as string | null,
    registrationCloses: '2026-08-10T00:00:00Z' as string | null,
    trailId: null,
    trailName: null,
    trailSlug: null,
    races: [] as RaceDto[],
    galleries: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    translationHashes: undefined as Record<string, string> | undefined,
    status: 'Confirmed',
    effectiveCancelled: false,
    needsReview: false,
  } as EventEditionDto,
  race: {
    id: 'race-1',
    eventEditionId: 'edition-1',
    trailId: null,
    trailName: null,
    trailSlug: null,
    name: 'Hvannadalshnjúkur Race',
    nameEn: 'Hvannadalshnjúkur Race' as string | null,
    distanceLabel: '20km',
    distanceLabelEn: '20km' as string | null,
    cutoffMinutes: 240,
    description: 'Lýsing á hlaupi',
    descriptionEn: 'Old English race description' as string | null,
    status: 'Active',
    sortOrder: 0,
    ticketStatus: 'Available',
    resultType: 'Time',
    maxParticipants: null,
    itraPoints: null,
    certifiedBy: null,
    certifiedByEn: null,
    prizeMoney: 0,
    championshipCategory: null,
    championshipCategoryEn: null,
    dateOfRace: '2026-08-15',
    startTime: '09:00:00',
    trailDistanceMeters: null,
    trailElevationGain: null,
    activityType: 'TrailRunning',
    translationHashes: undefined as Record<string, string> | undefined,
    // #1622: non-zero so the "saving Description leaves registrationOpensMinutesBeforeRace
    // unchanged" assertion has a real value to prove survives the save.
    registrationOpensMinutesBeforeRace: 30 as number | null,
  } as RaceDto,
  location: {
    id: 'location-1',
    name: 'Hengill',
    nameEn: 'Hengill' as string | null,
    slug: 'hengill',
    description: 'Lýsing á svæði',
    descriptionEn: 'Old English location description' as string | null,
    type: 'Area',
    parentId: null,
    parentName: null,
    latitude: null,
    longitude: null,
    radius: null,
    childrenCount: 0,
    translationHashes: undefined as Record<string, string> | undefined,
  } as LocationDto,
  organizer: {
    id: 'organizer-1',
    name: 'Hlaupahópur',
    slug: 'hlaupahopur',
    kennitala: null,
    phone: null,
    email: null,
    website: null,
    description: 'Lýsing á félagi',
    descriptionEn: 'Old English organizer description' as string | null,
    contactName: null,
    eventCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    // #1622: non-null so the "saving Description leaves socialLinks unchanged" assertion has a
    // real value to prove survives the save.
    socialLinks: [{ type: 'facebook', url: 'https://facebook.com/hlaupahopur' }],
    translationHashes: undefined as Record<string, string> | undefined,
  } as OrganizerDto,
  putCalls: [] as { endpoint: string; body: Record<string, unknown> }[],
  translateCalls: [] as string[][],
}));

// Wired here rather than inline above — mockState can't reference itself mid-initializer. Nests
// the Edition fixture under the Event fixture (and the Race under the Edition) so buildItems'
// e.editions/ed.races traversal surfaces them as their own clickTranslateFor-able rows.
mockState.event.editions = [mockState.edition];
mockState.edition.races = [mockState.race];

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? 'GET';
    if (method === 'GET') {
      if (endpoint === '/api/v1/admin/events/details') return Promise.resolve([mockState.event]);
      if (endpoint === '/api/v1/admin/trails') return Promise.resolve([mockState.trail]);
      if (endpoint === '/api/v1/admin/locations') return Promise.resolve([mockState.location]);
      if (endpoint === '/api/v1/admin/organizers') return Promise.resolve([mockState.organizer]);
      if (endpoint === '/api/v1/admin/tags') return Promise.resolve([mockState.tag]);
      return Promise.resolve([]);
    }
    if (endpoint === '/api/v1/admin/translate') {
      const { texts } = JSON.parse(options!.body as string) as { texts: string[] };
      mockState.translateCalls.push(texts);
      // Marks machine-translated output distinctly from a verbatim copy so assertions can tell
      // the two patch sources apart.
      return Promise.resolve({ translations: texts.map(t => `EN:${t}`) });
    }
    if (method === 'PUT') {
      const body = JSON.parse(options!.body as string) as Record<string, unknown>;
      mockState.putCalls.push({ endpoint, body });
      return Promise.resolve({});
    }
    return Promise.resolve({});
  }),
}));

function renderTranslationHealth() {
  render(<TranslationHealth onNotify={() => {}} />);
}

/** Finds the table row whose text content includes `displayName` and clicks its action button. */
async function clickTranslateFor(displayName: string) {
  const rows = await screen.findAllByRole('row');
  const row = rows.find(r => within(r).queryAllByText(displayName).length > 0);
  if (!row) throw new Error(`No row found for "${displayName}"`);
  fireEvent.click(within(row).getByRole('button'));
}

describe('TranslationHealth — Name field excluded from DeepL (#1481)', () => {
  beforeEach(() => {
    mockState.trail.nameEn = null;
    mockState.trail.descriptionEn = null;
    mockState.trail.translationHashes = undefined;
    mockState.tag.nameEn = null;
    mockState.putCalls = [];
    mockState.translateCalls = [];
  });

  afterEach(cleanup);

  it('copies a missing Trail Name verbatim and machine-translates Description in one PUT', async () => {
    renderTranslationHealth();

    await clickTranslateFor('Súlur Vertical');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/trails/trail-1');
    // Name copied verbatim — exact IS text, no "EN:" marker, so it never went through translate().
    expect(body.nameEn).toBe('Súlur Vertical');
    // Description still machine-translated.
    expect(body.descriptionEn).toBe('EN:Lýsing á leiðinni');

    // The proper-noun Name text must never appear in a /translate request body.
    const allTranslatedTexts = mockState.translateCalls.flat();
    expect(allTranslatedTexts).not.toContain('Súlur Vertical');
    expect(allTranslatedTexts).toContain('Lýsing á leiðinni');
  });

  it('still machine-translates a Tag Name (category label, not a proper noun)', async () => {
    renderTranslationHealth();

    await clickTranslateFor('Fjallahlaup');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/tags/tag-1');
    expect(body.nameEn).toBe('EN:Fjallahlaup');
    expect(mockState.translateCalls.flat()).toContain('Fjallahlaup');
  });

  it('re-copies a changed Trail Name when it is flagged stale, same mechanism as other fields', async () => {
    // Simulate a prior translation (hash of the *old* IS name) followed by the IS name changing —
    // the same staleness shape isStale() already detects for machine-translated fields.
    mockState.trail.nameEn = 'Old English Name';
    mockState.trail.descriptionEn = 'Old English Description';
    mockState.trail.translationHashes = {
      Name: hashText('Old Súlur Name'),
      Description: hashText('Lýsing á leiðinni'),
    };

    renderTranslationHealth();

    await clickTranslateFor('Súlur Vertical');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ body }] = mockState.putCalls;
    // Re-copied to the *current* IS name, verbatim, with no DeepL call for it.
    expect(body.nameEn).toBe('Súlur Vertical');
    expect(mockState.translateCalls.flat()).not.toContain('Súlur Vertical');
    // Description's hash still matches its current IS text, so it's neither missing nor stale —
    // savePatch's base PUT body carries it through unchanged (not part of this PUT's target fields).
    expect(body.descriptionEn).toBe('Old English Description');
  });
});

// #1485: translateItem and translateAll used to each inline their own copy of the
// toTranslate/toCopy split + patch-building logic. They now share one helper
// (buildTranslationPatch), but the only way to catch a regression that reintroduces a second,
// diverging copy is to exercise the bulk path on its own — translateItem's test above never
// touches translateAll's loop. This drives the "Translate all missing" button and asserts the
// same translatable/copy-verbatim split, independently, across both fixtures (Trail + Tag) in
// one bulk run.
describe('TranslationHealth — "Translate all missing" bulk path (#1485)', () => {
  beforeEach(() => {
    mockState.trail.nameEn = null;
    mockState.trail.descriptionEn = null;
    mockState.trail.translationHashes = undefined;
    mockState.tag.nameEn = null;
    mockState.putCalls = [];
    mockState.translateCalls = [];
  });

  afterEach(cleanup);

  it('copies verbatim Name fields and machine-translates the rest across all missing items in one bulk run', async () => {
    renderTranslationHealth();

    const button = await screen.findByRole('button', { name: /Translate all missing/ });
    fireEvent.click(button);

    // One PUT per item: the Trail (Name + Description) and the Tag (Name).
    await waitFor(() => expect(mockState.putCalls).toHaveLength(2));

    const trailCall = mockState.putCalls.find(c => c.endpoint === '/api/v1/admin/trails/trail-1');
    const tagCall = mockState.putCalls.find(c => c.endpoint === '/api/v1/admin/tags/tag-1');
    if (!trailCall || !tagCall) throw new Error('Expected a PUT for both the Trail and the Tag');

    // Trail Name (translatable: false) copied verbatim — never sent to /translate.
    expect(trailCall.body.nameEn).toBe('Súlur Vertical');
    // Trail Description machine-translated.
    expect(trailCall.body.descriptionEn).toBe('EN:Lýsing á leiðinni');
    // Tag Name is translatable, so — unlike the Trail's Name — it IS machine-translated.
    expect(tagCall.body.nameEn).toBe('EN:Fjallahlaup');

    const allTranslatedTexts = mockState.translateCalls.flat();
    expect(allTranslatedTexts).not.toContain('Súlur Vertical');
    expect(allTranslatedTexts).toContain('Lýsing á leiðinni');
    expect(allTranslatedTexts).toContain('Fjallahlaup');
  });
});

// #1582: Event/Location/Organizer PUT bodies omitted `id`, so model binding defaulted it to
// Guid.Empty and the backend's `id != command.Id` guard rejected every save with a 400 — only the
// Edition/Race/Trail branches of savePatch included their own `id`. This asserts the PUT body for
// each of the three previously-broken kinds now carries the correct id, mirroring the existing
// endpoint/body assertions above for Trail/Tag.
describe('TranslationHealth — Event/Location/Organizer PUT body includes id (#1582)', () => {
  beforeEach(() => {
    mockState.event.descriptionEn = null;
    mockState.location.descriptionEn = null;
    mockState.organizer.descriptionEn = null;
    mockState.putCalls = [];
    mockState.translateCalls = [];
  });

  afterEach(cleanup);

  it('includes the Event id in its PUT body', async () => {
    renderTranslationHealth();

    await clickTranslateFor('Hengill Ultra');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/events/event-1');
    expect(body.id).toBe('event-1');
  });

  it('includes the Location id in its PUT body', async () => {
    renderTranslationHealth();

    await clickTranslateFor('Hengill');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/locations/location-1');
    expect(body.id).toBe('location-1');
  });

  it('includes the Organizer id in its PUT body', async () => {
    renderTranslationHealth();

    await clickTranslateFor('Hlaupahópur');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/organizers/organizer-1');
    expect(body.id).toBe('organizer-1');
  });
});

// #1622: savePatch's Event/Edition/Race/Trail/Organizer branches built their PUT body from a
// hand-written object literal that had drifted out of sync with their Update*Command handlers —
// each of those five handlers writes one field unconditionally with no null-guard
// (gpxPointLat/gpxPointLng, endDate/registrationOpens/registrationCloses,
// registrationOpensMinutesBeforeRace, youtubeUrl, socialLinks respectively) that the hand-written
// literal never included, so every Translation Health save silently nulled it. Fixed by spreading
// the full already-loaded raw object as the PUT body base instead. This asserts, per entity, that
// saving an unrelated field leaves that entity's previously-omitted field untouched, and that the
// actual target-field translation still lands (proving `...patch` still overrides the base spread).
describe('TranslationHealth — savePatch preserves unlisted command fields (#1622)', () => {
  beforeEach(() => {
    mockState.event.descriptionEn = 'Old English event description';
    mockState.edition.notesEn = 'Old English notes';
    mockState.race.descriptionEn = 'Old English race description';
    mockState.trail.nameEn = null;
    mockState.trail.descriptionEn = null;
    mockState.trail.translationHashes = undefined;
    mockState.organizer.descriptionEn = 'Old English organizer description';
    mockState.putCalls = [];
    mockState.translateCalls = [];
  });

  afterEach(cleanup);

  it('Event: saving Description leaves gpxPointLat/gpxPointLng unchanged and still translates Description', async () => {
    mockState.event.descriptionEn = null;
    renderTranslationHealth();

    await clickTranslateFor('Hengill Ultra');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/events/event-1');
    expect(body.gpxPointLat).toBe(64.123);
    expect(body.gpxPointLng).toBe(-21.456);
    expect(body.descriptionEn).toBe('EN:Lýsing á viðburði');
  });

  it('Edition: saving Notes leaves endDate/registrationOpens/registrationCloses unchanged and still translates Notes', async () => {
    mockState.edition.notesEn = null;
    renderTranslationHealth();

    await clickTranslateFor('Edition 2026');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/editions/edition-1');
    expect(body.endDate).toBe('2026-08-16');
    expect(body.registrationOpens).toBe('2026-06-01T00:00:00Z');
    expect(body.registrationCloses).toBe('2026-08-10T00:00:00Z');
    expect(body.notesEn).toBe('EN:Athugasemdir um mótið');
  });

  it('Race: saving Description leaves registrationOpensMinutesBeforeRace unchanged and still translates Description', async () => {
    mockState.race.descriptionEn = null;
    renderTranslationHealth();

    await clickTranslateFor('Hvannadalshnjúkur Race');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/races/race-1');
    expect(body.registrationOpensMinutesBeforeRace).toBe(30);
    expect(body.descriptionEn).toBe('EN:Lýsing á hlaupi');
  });

  it('Trail: saving Description leaves youtubeUrl unchanged and still translates Description', async () => {
    renderTranslationHealth();

    await clickTranslateFor('Súlur Vertical');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/trails/trail-1');
    expect(body.youtubeUrl).toBe('https://youtube.com/watch?v=old');
    expect(body.descriptionEn).toBe('EN:Lýsing á leiðinni');
  });

  it('Organizer: saving Description leaves socialLinks unchanged and still translates Description', async () => {
    mockState.organizer.descriptionEn = null;
    renderTranslationHealth();

    await clickTranslateFor('Hlaupahópur');

    await waitFor(() => expect(mockState.putCalls).toHaveLength(1));
    const [{ endpoint, body }] = mockState.putCalls;
    expect(endpoint).toBe('/api/v1/admin/organizers/organizer-1');
    expect(body.socialLinks).toEqual([{ type: 'facebook', url: 'https://facebook.com/hlaupahopur' }]);
    expect(body.descriptionEn).toBe('EN:Lýsing á félagi');
  });
});

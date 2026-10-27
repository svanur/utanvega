// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import TranslationHealth from './TranslationHealth';
import { hashText } from '../utils/translationHash';
import type { Trail } from '../hooks/useTrails';
import type { TagDto } from '../hooks/useTags';

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
  putCalls: [] as { endpoint: string; body: Record<string, unknown> }[],
  translateCalls: [] as string[][],
}));

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? 'GET';
    if (method === 'GET') {
      if (endpoint === '/api/v1/admin/events/details') return Promise.resolve([]);
      if (endpoint === '/api/v1/admin/trails') return Promise.resolve([mockState.trail]);
      if (endpoint === '/api/v1/admin/locations') return Promise.resolve([]);
      if (endpoint === '/api/v1/admin/organizers') return Promise.resolve([]);
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

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import RaceFormCard from './RaceFormCard';
import type { EventEditionDto } from '../../hooks/useEvents';

// #960: RaceFormCard -> useTranslate -> api.ts -> supabase.ts, and supabase.ts calls
// requireEnv('VITE_SUPABASE_URL') at module-evaluation time — in a clean checkout with no
// .env.local this throws before a single test runs, even though neither test below exercises
// translation (translate() is only reached from handleTranslate, which nothing here triggers).
// Same fix as useEvents.test.ts / EventHealth.test.tsx: mock the module one level up so the
// chain never reaches supabase.ts.
vi.mock('../../hooks/api', () => ({
  apiFetch: vi.fn(),
}));

// #809: unit tests in utils/itraPoints.test.ts cover correctEmptyToOneFromSpinner as a pure
// function, but that only proves the decision logic is correct given a boolean — not that
// RaceFormCard's onPaste handler actually sets itraRealInputRef before onChange reads it (see
// RaceFormCard.tsx:315-344). This renders the real card and dispatches a real paste event to
// verify the wiring end to end, not just the function it feeds.

const edition: EventEditionDto = {
  id: 'edition-1',
  eventId: 'event-1',
  year: 2026,
  date: '2026-06-01',
  endDate: null,
  title: 'Test Edition',
  titleEn: null,
  registrationUrl: null,
  resultsUrl: null,
  notes: null,
  notesEn: null,
  registrationStatus: 'NotStarted',
  registrationOpens: null,
  registrationCloses: null,
  trailId: null,
  trailName: null,
  trailSlug: null,
  races: [],
  galleries: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
  status: 'Active',
  effectiveCancelled: false,
  needsReview: false,
};

function renderRaceFormCard() {
  return render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <RaceFormCard
        race={null}
        edition={edition}
        trails={[]}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
        onNotify={() => {}}
        onCreateRace={async () => ''}
        onUpdateRace={async () => {}}
        onDeleteRace={async () => {}}
      />
    </LocalizationProvider>,
  );
}

describe('RaceFormCard — ITRA points paste wiring', () => {
  afterEach(cleanup);

  it('keeps a pasted "1" in an empty field instead of correcting it to "0" like a spinner click', () => {
    renderRaceFormCard();
    const input = screen.getByLabelText('ITRA points') as HTMLInputElement;
    expect(input.value).toBe('');

    // A real paste always fires a native 'paste' event on the input before the browser applies
    // the pasted text and fires 'change' — this dispatches both, in that order, the same way a
    // real right-click → Paste would, to prove onPaste sets itraRealInputRef before onChange
    // reads it (rather than only asserting the pure function in isolation).
    fireEvent.paste(input, { clipboardData: { getData: () => '1' } });
    fireEvent.change(input, { target: { value: '1' } });

    expect(input.value).toBe('1');
  });
});

// #810: same failure class as #809 above, but for drag-and-drop text insertion instead of paste —
// dropping text into the field also fires onChange with no preceding keydown or paste, so it needs
// its own onDrop wiring (RaceFormCard.tsx:335) to be recognized as real input rather than a
// spinner click. This dispatches a real 'drop' + 'change' event to prove that wiring end to end.
describe('RaceFormCard — ITRA points drag-and-drop wiring', () => {
  afterEach(cleanup);

  it('keeps a dropped "1" in an empty field instead of correcting it to "0" like a spinner click', () => {
    renderRaceFormCard();
    const input = screen.getByLabelText('ITRA points') as HTMLInputElement;
    expect(input.value).toBe('');

    fireEvent.drop(input, { dataTransfer: { getData: () => '1' } });
    fireEvent.change(input, { target: { value: '1' } });

    expect(input.value).toBe('1');
  });
});

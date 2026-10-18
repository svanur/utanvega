// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import RaceDayPage, { parseDateParam } from './RaceDayPage';

// #1241: RaceDayPage.tsx:92-93 seeds `date`/`mode` state from parseDateParam(searchParams.get
// ('date')) with zero test coverage (flagged non-blocking in PR #1239's round-1 review). This
// module imports hooks/api.ts, which transitively imports hooks/supabase.ts — that module throws
// at import time if VITE_SUPABASE_URL isn't set (as in CI), so '../hooks/api' must be mocked here
// the same way EventHealth.test.tsx does, even though this test only exercises a pure function.

const apiFetchMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('../hooks/api', () => ({
  apiFetch: apiFetchMock,
}));

describe('parseDateParam', () => {
  it('parses a valid YYYY-MM-DD param into the same date', () => {
    const result = parseDateParam('2026-10-01');

    expect(result.format('YYYY-MM-DD')).toBe('2026-10-01');
  });

  it('falls back to today when the param is null', () => {
    const result = parseDateParam(null);

    expect(result.isSame(dayjs(), 'day')).toBe(true);
  });

  it('falls back to today when the param is not a valid date', () => {
    const result = parseDateParam('not-a-date');

    expect(result.isSame(dayjs(), 'day')).toBe(true);
  });
});

// #1240: `date`/`mode` were only seeded from the URL inside the mount-time lazy initializers
// above, so re-clicking the "Race Manager" sidebar item to the bare /race-day path (or jumping
// straight to a new ?date= link, e.g. from an edition's "jump to Race Manager") left local state
// pointing at the old date while the URL moved on, since neither nav action remounts RaceDayPage
// (App.tsx's render ternary keys off location.pathname alone, see pathToPage). These tests drive
// that same "no remount, just a URL change" scenario via useNavigate and assert on the `date` query
// string RaceDayPage's own data-loading effect (loadEditions, keyed off `dateStr`) sends to
// apiFetch — a proxy for "local `date` state followed the URL" that doesn't depend on how the MUI
// DatePicker happens to format its displayed value.
describe('RaceDayPage URL -> state date sync', () => {
  afterEach(() => {
    cleanup();
    apiFetchMock.mockClear();
  });

  function datesRequested() {
    return apiFetchMock.mock.calls
      .map(([endpoint]) => String(endpoint))
      .filter(endpoint => endpoint.startsWith('/api/v1/admin/race-day?date='))
      .map(endpoint => endpoint.split('date=')[1]);
  }

  function Harness() {
    const navigate = useNavigate();
    return (
      <>
        <button onClick={() => navigate('/race-day')}>reclick-nav-item</button>
        <button onClick={() => navigate('/race-day?date=2026-11-05')}>jump-to-date</button>
        <RaceDayPage onNotify={() => {}} />
      </>
    );
  }

  it('reloads for today when the sidebar nav item is re-clicked, dropping the date param', async () => {
    render(
      <MemoryRouter initialEntries={['/race-day?date=2026-10-01']}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Harness />
        </LocalizationProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(datesRequested()).toContain('2026-10-01'));

    fireEvent.click(screen.getByText('reclick-nav-item'));

    const today = dayjs().format('YYYY-MM-DD');
    await waitFor(() => expect(datesRequested()).toContain(today));
  });

  it('reloads for the new date when navigating straight to a ?date= link without a reload', async () => {
    render(
      <MemoryRouter initialEntries={['/race-day']}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Harness />
        </LocalizationProvider>
      </MemoryRouter>
    );

    const today = dayjs().format('YYYY-MM-DD');
    await waitFor(() => expect(datesRequested()).toContain(today));

    fireEvent.click(screen.getByText('jump-to-date'));

    await waitFor(() => expect(datesRequested()).toContain('2026-11-05'));
  });
});

// #1288: markEditionsCompleted's optimistic local patch (RaceDayPage.tsx:325-333) mirrors the
// backend's CompleteWithRaces(), which leaves registrationStatus untouched for both NotRequired
// and Invitational editions (EventEdition.IsDeliberateOverride). The patch here was only updated
// for NotRequired when Invitational was added (#1245), so an Invitational edition's displayed
// registrationStatus was being flipped to Closed locally until the next refetch corrected it.
// The "Reg closed" progress chip (editionProgress, done: ed.registrationStatus === 'Closed') is
// used as the observable proxy for registrationStatus here, since the registrationStatus <Select>
// itself only lists NotStarted/Open/Closed as menu items and renders no visible text for a value
// outside that set.
describe('RaceDayPage markEditionsCompleted registrationStatus patch (#1288)', () => {
  afterEach(() => {
    cleanup();
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue([]);
  });

  const baseRace = {
    name: 'Race A', nameEn: null, distanceLabel: null, distanceLabelEn: null,
    status: 'Completed', ticketStatus: 'Closed', sortOrder: 0,
    activityType: null, startTime: null, cutoffMinutes: null, resultType: null,
  };

  const invitationalEdition = {
    id: 'ed-invitational', eventId: 'event-invitational', eventName: 'Invitational Trail Run',
    eventSlug: 'invitational-trail-run', eventType: 'Trail', eventStatus: 'Confirmed',
    editionStatus: 'Active', date: '2026-10-18', endDate: null, title: null,
    resultsUrl: null, registrationUrl: null, registrationStatus: 'Invitational',
    races: [{ ...baseRace, id: 'race-invitational' }],
  };

  const openEdition = {
    ...invitationalEdition,
    id: 'ed-open', eventId: 'event-open', eventName: 'Open Registration Run',
    eventSlug: 'open-registration-run', registrationStatus: 'Open',
    races: [{ ...baseRace, id: 'race-open' }],
  };

  it("leaves an Invitational edition's registrationStatus unchanged while an Open one closes, after Mark Editions Completed", async () => {
    apiFetchMock.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/api/v1/admin/race-day?date=')) {
        return Promise.resolve([invitationalEdition, openEdition]);
      }
      if (endpoint.includes('/complete')) {
        return Promise.resolve({});
      }
      return Promise.resolve(null);
    });

    render(
      <MemoryRouter initialEntries={['/race-day']}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <RaceDayPage onNotify={() => {}} />
        </LocalizationProvider>
      </MemoryRouter>
    );

    await screen.findByText('Invitational Trail Run');
    await screen.findByText('Open Registration Run');

    fireEvent.click(screen.getByRole('button', { name: 'Mark Editions Completed' }));

    const invitationalPaper = screen.getByText('Invitational Trail Run').closest('.MuiPaper-root') as HTMLElement;
    const openPaper = screen.getByText('Open Registration Run').closest('.MuiPaper-root') as HTMLElement;

    // Invitational stays exempt: the "Reg closed" chip must remain not-done (outlined).
    await waitFor(() => {
      const regChip = within(invitationalPaper).getByText('Reg closed').closest('.MuiChip-root');
      expect(regChip?.className).toContain('MuiChip-outlined');
    });

    // Regression guard: a plain Open edition still closes as before (filled/done).
    const openRegChip = within(openPaper).getByText('Reg closed').closest('.MuiChip-root');
    expect(openRegChip?.className).toContain('MuiChip-filled');
  });
});

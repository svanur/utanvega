// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

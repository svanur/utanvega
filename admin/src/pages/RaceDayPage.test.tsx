import { describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { parseDateParam } from './RaceDayPage';

// #1241: RaceDayPage.tsx:92-93 seeds `date`/`mode` state from parseDateParam(searchParams.get
// ('date')) with zero test coverage (flagged non-blocking in PR #1239's round-1 review). This
// module imports hooks/api.ts, which transitively imports hooks/supabase.ts — that module throws
// at import time if VITE_SUPABASE_URL isn't set (as in CI), so '../hooks/api' must be mocked here
// the same way EventHealth.test.tsx does, even though this test only exercises a pure function.

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn().mockResolvedValue([]),
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

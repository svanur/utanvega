// @vitest-environment jsdom
//
// #1876: covers AdventCalendarPage's door-grid lock state, the retry-without-lockout shape of a
// wrong MCQ pick, a correct pick's localStorage persistence across a simulated reload, and the
// "share for a bonus ticket" button's win-gated visibility — the four cases called out explicitly
// in #1876's acceptance criteria for this file. Follows NewsletterPage.test.tsx's jsdom-opt-in +
// RTL + real-i18next-instance + mocked-Layout pattern.
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';

afterEach(cleanup);

// AdventCalendarPage's t() calls need a real, initialized i18next instance (react-i18next's
// useTranslation() otherwise falls back to raw keys) — initialized once with the real EN
// resources, mirroring NewsletterPage.test.tsx:25-30.
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// NewsletterPage.test.tsx's #1645 precedent mocks out Layout: it pulls in useMediaQuery (jsdom
// has no window.matchMedia implementation, so a real Layout render throws). Mocked to a bare
// passthrough so AdventCalendarPage's own content — the thing under test — still renders.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import AdventCalendarPage from './AdventCalendarPage';

const STORAGE_KEY = 'utanvega_advent_calendar_2026';

function renderPage() {
    return render(
        <MemoryRouter>
            <AdventCalendarPage mode="light" onToggleMode={() => {}} />
        </MemoryRouter>,
    );
}

function doorAriaName(key: 'doorAriaOpen' | 'doorAriaWon' | 'doorAriaLocked', day: number): string {
    return (en.advent[key] as string).replace('{{day}}', String(day));
}

function mockQuestion(day: number) {
    return {
        day,
        textIs: `Spurning ${day}`,
        textEn: `Question ${day}`,
        choicesIs: ['A', 'B', 'C', 'D'],
        choicesEn: ['A', 'B', 'C', 'D'],
        linkUrl: 'https://example.com/learn-more',
        linkLabelIs: 'Sjá meira',
        linkLabelEn: 'Learn more',
    };
}

async function openDoor(day: number) {
    fireEvent.click(screen.getByRole('button', { name: doorAriaName('doorAriaOpen', day) }));
    await screen.findByText(`Question ${day}`);
}

describe('AdventCalendarPage door grid + quiz (#1876)', () => {
    beforeEach(() => {
        localStorage.clear();
        // Only Date is faked (not setTimeout/setInterval) so @testing-library/react's findBy*/
        // waitFor polling — which itself relies on real timers — keeps working; a plain
        // vi.useFakeTimers() with no `toFake` filter would also stub those and hang every
        // findBy*/waitFor call below.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-12-05T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('renders doors 1-5 open and 6-24 visibly locked on Dec 5', () => {
        renderPage();

        for (let day = 1; day <= 5; day++) {
            const btn = screen.getByRole('button', { name: doorAriaName('doorAriaOpen', day) });
            expect((btn as HTMLButtonElement).disabled).toBe(false);
        }
        for (let day = 6; day <= 24; day++) {
            const btn = screen.getByRole('button', { name: doorAriaName('doorAriaLocked', day) });
            expect((btn as HTMLButtonElement).disabled).toBe(true);
        }
    });

    it('a wrong pick disables only that choice; the other three stay pickable, with no lockout', async () => {
        const fetchSpy = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => mockQuestion(1) }) // GET /advent/1
            .mockResolvedValueOnce({ ok: true, json: async () => ({ isCorrect: false }) }) // POST /advent/answer (1st pick)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ isCorrect: false }) }); // POST /advent/answer (retry)
        vi.stubGlobal('fetch', fetchSpy);

        renderPage();
        await openDoor(1);

        fireEvent.change(screen.getByLabelText(en.advent.emailLabel), { target: { value: 'runner@example.com' } });

        const choices = screen.getAllByRole('button', { name: /^[ABCD]$/ });
        fireEvent.click(choices[0]);

        await waitFor(() => expect((choices[0] as HTMLButtonElement).disabled).toBe(true));
        expect((choices[1] as HTMLButtonElement).disabled).toBe(false);
        expect((choices[2] as HTMLButtonElement).disabled).toBe(false);
        expect((choices[3] as HTMLButtonElement).disabled).toBe(false);

        // Retry is immediate — picking a still-enabled choice doesn't error or get blocked.
        fireEvent.click(choices[1]);
        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
        expect((choices[1] as HTMLButtonElement).disabled).toBe(true);
        expect((choices[2] as HTMLButtonElement).disabled).toBe(false);
        expect((choices[3] as HTMLButtonElement).disabled).toBe(false);
    });

    it('a correct pick marks the day won, persists to localStorage, and survives reload', async () => {
        const fetchSpy = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => mockQuestion(1) }) // GET /advent/1
            .mockResolvedValueOnce({ ok: true, json: async () => ({ isCorrect: true }) }); // POST /advent/answer
        vi.stubGlobal('fetch', fetchSpy);

        renderPage();
        await openDoor(1);

        fireEvent.change(screen.getByLabelText(en.advent.emailLabel), { target: { value: 'runner@example.com' } });
        const choices = screen.getAllByRole('button', { name: /^[ABCD]$/ });
        fireEvent.click(choices[0]);

        await screen.findByText(en.advent.correctTitle);
        expect(screen.getByRole('link', { name: 'Learn more' })).not.toBeNull();

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        expect(stored.won['1']).toBe(true);
        expect(stored.email).toBe('runner@example.com');

        // Simulate a page reload: unmount and render a fresh instance — state is gone, only
        // localStorage survives, same as a real browser refresh.
        cleanup();
        renderPage();

        const reloadedDoor = screen.getByRole('button', { name: doorAriaName('doorAriaWon', 1) });
        expect(reloadedDoor).not.toBeNull();
    });

    it('hides "share for a bonus ticket" until the day is won, then shows it and calls POST /advent/share', async () => {
        const fetchSpy = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => mockQuestion(1) }) // GET /advent/1
            .mockResolvedValueOnce({ ok: true, json: async () => ({ isCorrect: true }) }) // POST /advent/answer
            .mockResolvedValueOnce({ ok: true, json: async () => ({ granted: true }) }); // POST /advent/share
        vi.stubGlobal('fetch', fetchSpy);
        // jsdom has no navigator.share — the else-branch opens a Facebook intent via window.open,
        // which this suppresses so the test doesn't depend on jsdom's "not implemented" stub.
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        renderPage();
        await openDoor(1);

        expect(screen.queryByRole('button', { name: en.advent.shareButton })).toBeNull();

        fireEvent.change(screen.getByLabelText(en.advent.emailLabel), { target: { value: 'runner@example.com' } });
        const choices = screen.getAllByRole('button', { name: /^[ABCD]$/ });
        fireEvent.click(choices[0]);

        const shareButton = await screen.findByRole('button', { name: en.advent.shareButton });
        fireEvent.click(shareButton);

        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
        const shareCall = fetchSpy.mock.calls[2];
        expect(shareCall[0]).toContain('/api/v1/advent/share');
        expect(JSON.parse(shareCall[1].body)).toEqual({ day: 1, email: 'runner@example.com' });

        openSpy.mockRestore();
    });

    // #1882 review follow-up: a failed GET was cached as `questions[day] = null` forever, so
    // reopening the door after a network error never retried (handleDoorClick only re-fetches
    // `if (!(day in questions))`). The retry button bypasses that cache check directly.
    it('shows a retry button on load failure, and retrying re-fetches the question', async () => {
        const fetchSpy = vi.fn()
            .mockRejectedValueOnce(new Error('network down')) // GET /advent/1 (first open)
            .mockResolvedValueOnce({ ok: true, json: async () => mockQuestion(1) }); // GET /advent/1 (retry)
        vi.stubGlobal('fetch', fetchSpy);

        renderPage();
        fireEvent.click(screen.getByRole('button', { name: doorAriaName('doorAriaOpen', 1) }));

        const retryButton = await screen.findByRole('button', { name: en.advent.retry });
        expect(screen.getByText(en.advent.loadError)).not.toBeNull();

        fireEvent.click(retryButton);

        await screen.findByText('Question 1');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});

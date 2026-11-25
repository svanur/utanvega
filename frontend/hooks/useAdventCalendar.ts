import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'utanvega_advent_calendar_2026';

/**
 * The one-time 2026 campaign year (#1875/#1876) — mirrors the hardcoded
 * `AdventCalendar.Year` constant on the backend (`backend/Application/Advent/AdventCalendar.cs`).
 * Not "the current year": a December run of this code in any other year must not light up doors.
 */
const CAMPAIGN_YEAR = 2026;

const DOOR_COUNT = 24;

interface AdventCalendarState {
    /** Captured once on the first attempted submission (correct or wrong) and reused silently
     *  on every later day — never re-prompted unless the visitor explicitly says "not you?". */
    email: string | null;
    /** Days this browser has a confirmed correct answer for. A plain map rather than a Set so it
     *  round-trips through JSON.stringify/parse without a custom (de)serializer. */
    won: Record<number, true>;
}

const EMPTY_STATE: AdventCalendarState = { email: null, won: {} };

/**
 * Client-side mirror of `AdventCalendar.IsDayUnlocked` on the backend — used only to decide which
 * door tiles render as open vs. locked without fetching all 24 questions up front. The backend
 * re-checks this on every request (`GetAdventQuestionQuery`, `SubmitAdventAnswerCommand`), so a
 * stale or spoofed client clock can at most make a door *look* open a day early — the fetch for
 * an actually-locked day still comes back 400 and the page falls back to the locked-door message.
 *
 * Iceland keeps UTC year-round with no DST (same fact `AdventCalendar.cs` relies on for its own
 * UTC fallback), so comparing against UTC midnight boundaries is a faithful mirror, not just an
 * approximation.
 */
export function isDoorUnlocked(day: number, now: Date = new Date()): boolean {
    if (day < 1 || day > DOOR_COUNT) return false;
    const unlockDateUtcMs = Date.UTC(CAMPAIGN_YEAR, 11, day); // December is month index 11
    return now.getTime() >= unlockDateUtcMs;
}

function readFromStorage(): AdventCalendarState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY_STATE;
        const parsed = JSON.parse(raw) as Partial<AdventCalendarState>;
        return { email: parsed.email ?? null, won: parsed.won ?? {} };
    } catch {
        return EMPTY_STATE;
    }
}

function writeToStorage(state: AdventCalendarState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* localStorage unavailable (private browsing, quota) — state just won't persist */
    }
}

export function useAdventCalendar() {
    const [state, setState] = useState<AdventCalendarState>(EMPTY_STATE);

    // Initialize from localStorage — mirrors useFavorites.ts's init-in-an-effect shape so this
    // hook is safe to call during SSR/first render without touching `localStorage` synchronously.
    useEffect(() => {
        setState(readFromStorage());
    }, []);

    const setEmail = useCallback((email: string) => {
        setState(prev => {
            const next = { ...prev, email };
            writeToStorage(next);
            return next;
        });
    }, []);

    // The "not you?" affordance (#1876 AC): clears the stored email only, leaving every already-won
    // day untouched — the next submission on any day re-prompts for an email instead of silently
    // reusing the old one.
    const clearEmail = useCallback(() => {
        setState(prev => {
            const next = { ...prev, email: null };
            writeToStorage(next);
            return next;
        });
    }, []);

    const markWon = useCallback((day: number) => {
        setState(prev => {
            if (prev.won[day]) return prev; // already recorded — no-op, matches the backend's idempotency
            const next = { ...prev, won: { ...prev.won, [day]: true as const } };
            writeToStorage(next);
            return next;
        });
    }, []);

    const hasWon = useCallback((day: number) => Boolean(state.won[day]), [state.won]);

    return { email: state.email, won: state.won, setEmail, clearEmail, markWon, hasWon };
}

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DELAY_MS = 300;

/**
 * Bridges a URL-backed search field (as returned by `useUrlFilterState`) to a text input that
 * must never drop a keystroke. `history.replaceState` — what `useUrlFilterState`'s writes boil
 * down to — is throttled by browsers when called in rapid succession; a search box whose
 * displayed value is the URL value itself will visibly snap backwards mid-typing the moment a
 * call gets dropped.
 *
 * `onChange` updates local state synchronously on every keystroke (so the input never lags)
 * and (re)schedules the URL write `delayMs` after the last change, so `replaceState` fires at
 * most once per pause in typing rather than once per character. `clear` bypasses the debounce
 * entirely — a search field's clear button is expected to update the URL immediately, not
 * after a delay.
 *
 * `urlValue` changing from outside this hook's own writes — a filter reset, browser
 * back/forward, or a bookmarked link — re-syncs local state to match. A write this hook just
 * made lands here too, but as a same-value no-op, since local state already holds it.
 *
 * Split into two effects, both keyed on `urlValue`, rather than one: the state-sync effect
 * is kept to that single `setValue` call so it reads as the plain "mirror a prop into state"
 * idiom; ref access (reading/clearing the pending debounce timer) lives in its own effect,
 * since refs may only be touched in effects/handlers, never during render. Without the
 * second effect, a debounce timer already in flight when `urlValue` changes externally would
 * still fire later with the stale pre-change value, silently overwriting the external change
 * right back into the URL and the input a moment after it took effect.
 */
export function useDebouncedUrlSearch(urlValue: string, setUrlValue: (value: string) => void, delayMs = DEFAULT_DELAY_MS) {
  const [value, setValue] = useState(urlValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(urlValue);
  }, [urlValue]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [urlValue]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const onChange = useCallback((next: string) => {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setUrlValue(next), delayMs);
  }, [setUrlValue, delayMs]);

  const clear = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setValue('');
    setUrlValue('');
  }, [setUrlValue]);

  return { value, onChange, clear };
}

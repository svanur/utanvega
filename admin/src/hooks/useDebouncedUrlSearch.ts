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
 */
export function useDebouncedUrlSearch(urlValue: string, setUrlValue: (value: string) => void, delayMs = DEFAULT_DELAY_MS) {
  const [value, setValue] = useState(urlValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(urlValue);
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

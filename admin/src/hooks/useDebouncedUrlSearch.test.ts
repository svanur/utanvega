// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedUrlSearch } from './useDebouncedUrlSearch';

// #876: useDebouncedUrlSearch (added in #868/#875) had zero test coverage. The fourth test
// below targets the review-round fix from #875 (commit 2e7fa88) — before that fix, a debounce
// timer already in flight when urlValue changed externally (filter reset, back/forward) would
// still fire later with the stale pre-change value, silently overwriting the external change.
// vitest.config.ts defaults to the `node` environment; @testing-library/react's `renderHook`
// mounts into a real `document` under the hood even though this hook itself never touches the
// DOM, so this file opts into jsdom the same way admin's existing component tests do.

describe('useDebouncedUrlSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initialUrlValue = '', delayMs = 300) {
    const setUrlValue = vi.fn();
    const { result, rerender } = renderHook(
      ({ urlValue }) => useDebouncedUrlSearch(urlValue, setUrlValue, delayMs),
      { initialProps: { urlValue: initialUrlValue } },
    );
    return { result, rerender, setUrlValue };
  }

  it('updates value immediately on change without calling setUrlValue before delayMs elapses', () => {
    const { result, setUrlValue } = setup();

    act(() => {
      result.current.onChange('trail');
    });

    expect(result.current.value).toBe('trail');
    expect(setUrlValue).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(setUrlValue).not.toHaveBeenCalled();
  });

  it('collapses rapid successive onChange calls into a single setUrlValue call with the last value', () => {
    const { result, setUrlValue } = setup();

    act(() => {
      result.current.onChange('t');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.onChange('tr');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.onChange('tra');
    });

    // Neither of the earlier two onChange calls should have let its own timer reach setUrlValue.
    expect(setUrlValue).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(setUrlValue).toHaveBeenCalledTimes(1);
    expect(setUrlValue).toHaveBeenCalledWith('tra');
  });

  it('clear() calls setUrlValue("") synchronously and resets value, even with a debounce timer pending', () => {
    const { result, setUrlValue } = setup();

    act(() => {
      result.current.onChange('pending');
    });
    expect(setUrlValue).not.toHaveBeenCalled();

    act(() => {
      result.current.clear();
    });

    expect(result.current.value).toBe('');
    expect(setUrlValue).toHaveBeenCalledTimes(1);
    expect(setUrlValue).toHaveBeenCalledWith('');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The timer pending from onChange('pending') must not have survived clear() and fired late
    // with the stale value.
    expect(setUrlValue).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending debounce timer when urlValue changes externally, so the stale value never reaches setUrlValue', () => {
    const { result, rerender, setUrlValue } = setup('initial');

    act(() => {
      result.current.onChange('typed');
    });
    expect(result.current.value).toBe('typed');

    // Simulates a filter reset or browser back/forward changing the URL-backed value out from
    // under the hook while its own debounce timer is still pending.
    rerender({ urlValue: 'external-change' });

    expect(result.current.value).toBe('external-change');
    expect(setUrlValue).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(setUrlValue).not.toHaveBeenCalled();
    expect(result.current.value).toBe('external-change');
  });
});

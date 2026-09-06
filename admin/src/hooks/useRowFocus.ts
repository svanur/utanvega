import { useState } from 'react';
import { usePageShortcuts, isInputFocused, isDialogOpen } from './usePageShortcuts';

/**
 * Local j/k/Enter/o row-focus for list pages. Tracks a cursor position within `rows`,
 * independent of any checkbox/selection state, and opens the focused row via `onOpen`.
 * Clamps at both ends (no wraparound). The raw index is clamped against the current row
 * count on every render (rather than via an effect) so a filter that narrows the results
 * takes effect immediately, before the next keypress.
 * Also wires Escape to blur a focused search/filter input, so j/k/o work again without
 * the mouse once a `/`-focused filter has narrowed the list.
 */
export function useRowFocus<T>(rows: T[], onOpen: (row: T) => void) {
  const [rawIndex, setRawIndex] = useState(-1);
  const focusedIndex = rows.length === 0 ? -1 : Math.min(rawIndex, rows.length - 1);

  usePageShortcuts([
    { key: 'j', skip: isDialogOpen, handler: () => { if (rows.length > 0) setRawIndex(Math.min(focusedIndex + 1, rows.length - 1)); } },
    { key: 'k', skip: isDialogOpen, handler: () => { if (rows.length > 0) setRawIndex(Math.max(focusedIndex - 1, 0)); } },
    { key: 'Enter', skip: isDialogOpen, handler: () => { const row = rows[focusedIndex]; if (row) onOpen(row); } },
    { key: 'o', skip: isDialogOpen, handler: () => { const row = rows[focusedIndex]; if (row) onOpen(row); } },
    // Escape blurs a focused search/filter input so j/k/o resume working against the
    // filtered rows, without touching the filter text or closing any open dialog.
    { key: 'Escape', allowInInput: true, skip: () => isDialogOpen() || !isInputFocused(), handler: () => (document.activeElement as HTMLElement)?.blur() },
  ]);

  return { focusedIndex, setFocusedIndex: setRawIndex };
}

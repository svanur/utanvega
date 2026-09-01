import { useState } from 'react';
import { usePageShortcuts, isInputFocused, isDialogOpen } from './usePageShortcuts';

export interface IdFocusableRow {
  id: string;
}

/**
 * Id-based sibling to `useRowFocus`, for lists whose visual order can be reshuffled by
 * something other than filtering — e.g. EventDetailPage's flat editions+races list, where
 * expanding/collapsing an edition inserts or removes rows above the focused one. Tracking a
 * plain index there would silently shift focus onto the wrong row; tracking the row's id
 * instead survives those inserts/removals, and survives a `refresh()` after an edit too, as
 * long as the same row is still present in `rows`.
 * Clamps at both ends (no wraparound): j/k with no current focus starts at the first/last
 * row respectively. Same Escape-blurs-input and dialog-backoff behaviour as `useRowFocus`.
 */
export function useIdRowFocus<T extends IdFocusableRow>(rows: T[], onOpen: (row: T) => void) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusedIndex = focusedId == null ? -1 : rows.findIndex(r => r.id === focusedId);

  usePageShortcuts([
    {
      key: 'j', skip: isDialogOpen, handler: () => {
        if (rows.length === 0) return;
        const next = focusedIndex < 0 ? 0 : Math.min(focusedIndex + 1, rows.length - 1);
        setFocusedId(rows[next]!.id);
      },
    },
    {
      key: 'k', skip: isDialogOpen, handler: () => {
        if (rows.length === 0) return;
        const next = focusedIndex < 0 ? 0 : Math.max(focusedIndex - 1, 0);
        setFocusedId(rows[next]!.id);
      },
    },
    { key: 'Enter', skip: isDialogOpen, handler: () => { const row = rows[focusedIndex]; if (row) onOpen(row); } },
    { key: 'o', skip: isDialogOpen, handler: () => { const row = rows[focusedIndex]; if (row) onOpen(row); } },
    // Escape blurs a focused search/filter input so j/k/o resume working against the
    // filtered rows, without touching the filter text or closing any open dialog.
    { key: 'Escape', allowInInput: true, skip: () => isDialogOpen() || !isInputFocused(), handler: () => (document.activeElement as HTMLElement)?.blur() },
  ]);

  return { focusedId, setFocusedId, focusedIndex };
}

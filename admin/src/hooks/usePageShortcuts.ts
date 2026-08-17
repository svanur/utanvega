import { useEffect, useRef } from 'react';

export interface PageShortcut {
  key: string;
  /** Requires Ctrl (or Cmd on Mac). */
  ctrl?: boolean;
  /** Fires even when a form element has focus. */
  allowInInput?: boolean;
  handler: () => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/**
 * Attach page-level keyboard shortcuts. The shortcuts array is read via a ref
 * so handlers always see current state without needing to re-register the listener.
 */
export function usePageShortcuts(shortcuts: PageShortcut[]) {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of ref.current) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = s.ctrl
          ? e.ctrlKey || e.metaKey
          : !e.ctrlKey && !e.metaKey && !e.altKey;
        if (!keyMatch || !ctrlMatch) continue;
        if (!s.allowInInput && isInputFocused()) continue;
        e.preventDefault();
        s.handler();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

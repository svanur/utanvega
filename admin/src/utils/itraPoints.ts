// The native <input type="number" min="0"> stepping algorithm treats an empty field as
// though it held 0, then applies the step BEFORE clamping to min — so clicking the
// spin-up button once on an empty field lands on 1 (0 + step), never on min (0) itself.
// (Stepping down from empty is unaffected: 0 - step = -1, which *is* below min, so the
// browser clamps that to 0 on its own — no JS needed for that direction.)
export function clampItraPoints(value: string): string {
  if (value.trim() === '') return value;
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return String(Math.min(6, Math.max(0, num)));
}

// There's no DOM element for the spin-up button itself to hook a click handler on —
// the only thing React can observe is the resulting onChange with the input's new
// value. The problem is that typing the digit "1" directly into an empty field, or
// pasting "1" into it (e.g. via right-click → Paste), fires an onChange with the exact
// same shape (previous value "", next value "1"), and 1 is a legitimate, common ITRA
// points value that must not be silently overwritten.
//
// A spin-button click never fires a keydown *or* a paste event on the input, whereas
// every real keystroke and every paste does. So `realUserInputOccurred` — set by a ref
// on keydown/paste and read/cleared on the very next onChange — lets us apply the "snap
// to 0" correction only when neither preceded the change, i.e. only for an actual
// spin-button click, never for a typed or pasted "1". Ctrl+V is covered by the keydown
// half of this already (the 'v' keydown sets the ref before onChange fires); the paste
// handler exists for mouse-only paste paths (context menu, "Paste" in an OS toolbar)
// that never touch the keyboard. The physical ArrowUp key is handled separately (see
// the onKeyDown handler where this is used) since, unlike a digit key, it can never be
// a legitimate typed value.
export function correctEmptyToOneFromSpinner(previous: string, next: string, realUserInputOccurred: boolean): string {
  if (realUserInputOccurred) return next;
  return previous.trim() === '' && next === '1' ? '0' : next;
}

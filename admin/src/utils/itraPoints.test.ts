import { describe, it, expect } from 'vitest';
import { clampItraPoints, correctEmptyToOneFromSpinner } from './itraPoints';

describe('clampItraPoints', () => {
  it('leaves an empty value alone', () => {
    expect(clampItraPoints('')).toBe('');
    expect(clampItraPoints('  ')).toBe('  ');
  });

  it('leaves a non-numeric value alone', () => {
    expect(clampItraPoints('abc')).toBe('abc');
  });

  it('clamps below the minimum up to 0', () => {
    expect(clampItraPoints('-3')).toBe('0');
  });

  it('clamps above the maximum down to 6', () => {
    expect(clampItraPoints('9')).toBe('6');
  });

  it('leaves an in-range value unchanged (as a string)', () => {
    expect(clampItraPoints('3')).toBe('3');
  });
});

// #799: correctEmptyToOneFromSpinner used to key off "did a keydown fire?" alone
// (cameFromKeydown), which misidentified a mouse-only context-menu paste (right-click →
// Paste) — no keydown, same as a spin-button click — as a spinner click and silently
// corrected a pasted "1" to "0". The fix widens the signal to any real user input
// (keystroke or paste), passed in as the explicit `realUserInputOccurred` boolean so the
// decision itself stays testable without simulating DOM paste events.
describe('correctEmptyToOneFromSpinner', () => {
  it('snaps an empty field to "0" when "1" arrives with no real user input (spin-button click)', () => {
    expect(correctEmptyToOneFromSpinner('', '1', false)).toBe('0');
  });

  it('keeps "1" when it arrives from real user input (typed keystroke) on an empty field', () => {
    expect(correctEmptyToOneFromSpinner('', '1', true)).toBe('1');
  });

  it('keeps "1" when it arrives from real user input (paste) on an empty field', () => {
    // This is the paste path: RaceFormCard's onPaste handler sets realUserInputOccurred
    // to true before onChange fires, exactly like onKeyDown already did for keystrokes.
    expect(correctEmptyToOneFromSpinner('', '1', true)).toBe('1');
  });

  it('does not touch a non-"1" value even with no real user input', () => {
    expect(correctEmptyToOneFromSpinner('', '5', false)).toBe('5');
    expect(correctEmptyToOneFromSpinner('', '', false)).toBe('');
  });

  it('does not touch a change on an already-non-empty previous value', () => {
    expect(correctEmptyToOneFromSpinner('2', '1', false)).toBe('1');
  });
});

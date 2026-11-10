import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView at all — EventDetailPage.tsx:1071's focusedId effect
// calls it unconditionally once useIdRowFocus reports a focused row, which every other describe
// block in that file avoids simply by never pressing j/k. Stubbing it here is a jsdom-gap
// workaround, not a behavioural mock: the effect's actual argument/call is never asserted on.
//
// Guarded: vitest.config.ts's default `environment: 'node'` means Element is undefined for most
// test files, which only opt into jsdom individually via a per-file `// @vitest-environment
// jsdom` docblock — but setupFiles run for every test file regardless of that per-file opt-in.
if (typeof Element !== 'undefined') {
    Element.prototype.scrollIntoView = vi.fn();
}

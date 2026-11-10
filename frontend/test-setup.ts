import { vi } from 'vitest';

// jsdom (unlike a real browser) doesn't implement Element.scrollIntoView at all — calling it
// throws "not a function" rather than silently no-op'ing, which would abort scrollToCard
// (LocationsPage.tsx:189) before it ever reaches the DOM highlight this file asserts on. Stubbed
// once, globally, as a no-op — the click tests below assert scrollToCard's *style* side effect,
// never that scrolling itself occurred.
//
// Guarded: vitest.config.ts's default `environment: 'node'` means Element is undefined for most
// test files, which only opt into jsdom individually via a per-file `// @vitest-environment
// jsdom` docblock — but setupFiles run for every test file regardless of that per-file opt-in.
if (typeof Element !== 'undefined') {
    Element.prototype.scrollIntoView = vi.fn();
}

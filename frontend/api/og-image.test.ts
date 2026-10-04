import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * @vercel/og's ImageResponse rasterizes the element tree through satori + resvg
 * (WASM), which isn't worth exercising in a unit test and isn't what this issue
 * is about — the goal here is only to verify which locale's copy ends up in the
 * element tree handler() builds, not pixel output. So ImageResponse is mocked to
 * just capture the element it was given; handler()'s own return value is still a
 * real Response (constructed from the mock), so callers that just want `await
 * handler(...)` to resolve keep working.
 */
// vi.mock() factories are hoisted above every other statement in this file, so
// anything they close over has to be created through vi.hoisted() — a plain
// top-level `const` here would be a TDZ ReferenceError the moment the hoisted
// factory ran.
const { captured, MockImageResponse } = vi.hoisted(() => {
  const captured: unknown[] = [];
  class MockImageResponse {
    constructor(element: unknown) {
      captured.push(element);
      // Intentional: swaps the instance for a real Response, which JS permits
      // when a constructor returns an object, so `new ImageResponse(...)` in
      // og-image.ts keeps getting a genuine Response without needing to know
      // it's mocked.
      return new Response(null, { status: 200 });
    }
  }
  return { captured, MockImageResponse };
});
vi.mock('@vercel/og', () => ({ ImageResponse: MockImageResponse }));

import handler from './og-image';

/**
 * Mirrors the request shape og-image.ts actually receives in production and the
 * pattern og.test.ts uses: the public hostname arrives via x-forwarded-host, not
 * the request URL's own host.
 */
function makeRequest(query: string, host: string): Request {
  return new Request(`https://internal.vercel.app/api/og-image?${query}`, {
    headers: { 'x-forwarded-host': host },
  });
}

/** Recursively collects every string leaf in the `h()`-built element tree. */
function flattenText(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(flattenText);
  if (node && typeof node === 'object') {
    const props = (node as { props?: { children?: unknown } }).props;
    if (props && 'children' in props) return flattenText(props.children);
  }
  return [];
}

async function renderedText(request: Request): Promise<string[]> {
  await handler(request);
  const element = captured[captured.length - 1];
  return flattenText(element);
}

describe('og-image.ts locale-aware branding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    captured.length = 0;
  });

  describe('trail-found branch (top-bar logo)', () => {
    const trail = {
      name: 'Esjan hringur',
      slug: 'esjan-hringur',
      length: 12000,
      elevationGain: 780,
      elevationLoss: 780,
      activityType: 'TrailRunning',
      difficulty: 'Hard',
      locations: [{ name: 'Reykjavík' }],
    };

    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(trail), { status: 200 }))
      );
    });

    it('shows the English/360Runs brand on the 360runs.com host', async () => {
      const text = await renderedText(makeRequest('slug=esjan-hringur', '360runs.com'));
      expect(text).toContain('🏃 360RUNS.COM');
      expect(text).not.toContain('🏃 HLAUPADAGSKRA.IS');
    });

    it('shows the unchanged Icelandic brand on the hlaupadagskra.is host', async () => {
      const text = await renderedText(makeRequest('slug=esjan-hringur', 'www.hlaupadagskra.is'));
      expect(text).toContain('🏃 HLAUPADAGSKRA.IS');
    });

    it('falls back to the Icelandic brand on an unknown host (preview deploys)', async () => {
      const text = await renderedText(
        makeRequest('slug=esjan-hringur', 'some-preview.vercel.app')
      );
      expect(text).toContain('🏃 HLAUPADAGSKRA.IS');
    });
  });

  describe('defaultImage() branch', () => {
    it('no-slug request: shows English heading/tagline on the 360runs.com host', async () => {
      const text = await renderedText(makeRequest('', '360runs.com'));
      expect(text).toContain('🏃 360Runs');
      expect(text).toContain('All running events in one place');
    });

    it('no-slug request: unchanged Icelandic heading/tagline on the hlaupadagskra.is host', async () => {
      const text = await renderedText(makeRequest('', 'www.hlaupadagskra.is'));
      expect(text).toContain('🏃 Hlaupadagskra.is');
      expect(text).toContain('Öll hlaup á einum stað');
    });

    it('failed backend fetch (non-ok response): varies by host too', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
      const text = await renderedText(makeRequest('slug=missing-trail', '360runs.com'));
      expect(text).toContain('🏃 360Runs');
      expect(text).toContain('All running events in one place');
    });

    it('thrown fetch error: varies by host too', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down');
        })
      );
      const text = await renderedText(makeRequest('slug=missing-trail', '360runs.com'));
      expect(text).toContain('🏃 360Runs');
      expect(text).toContain('All running events in one place');
    });
  });
});

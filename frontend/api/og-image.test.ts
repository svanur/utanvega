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

/** Recursively collects the `src` of every `img` element in the tree (logoImg()'s output). */
function flattenImgSrcs(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(flattenImgSrcs);
  if (node && typeof node === 'object') {
    const { type, props } = node as { type?: string; props?: { src?: string; children?: unknown } };
    const own = type === 'img' && typeof props?.src === 'string' ? [props.src] : [];
    const nested = props && 'children' in props ? flattenImgSrcs(props.children) : [];
    return [...own, ...nested];
  }
  return [];
}

/**
 * Renders once and derives both text and img srcs from the *same* captured
 * element, rather than calling handler() twice per test — two independent
 * calls would each append to the shared `captured` array, and reading
 * `captured[captured.length - 1]` from both risks one seeing the other's push.
 */
async function render(request: Request): Promise<{ text: string[]; imgSrcs: string[] }> {
  await handler(request);
  const element = captured[captured.length - 1];
  return { text: flattenText(element), imgSrcs: flattenImgSrcs(element) };
}

/**
 * Stubs global fetch to branch on the request URL: the `/icons/...` logo
 * request (logoUrl()'s preflight) is handled separately from the backend
 * trail request, since a single test often exercises both.
 */
function stubFetch(responder: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return responder(url, init);
    })
  );
}

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

/** Logo request/response pair: `ok` logo fetches resolve, by locale's LOGO_PATH stem. */
function isLogoRequest(url: string): boolean {
  return url.includes('/icons/');
}

describe('og-image.ts locale-aware branding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    captured.length = 0;
  });

  describe('trail-found branch (top-bar logo)', () => {
    beforeEach(() => {
      stubFetch((url) =>
        isLogoRequest(url)
          ? new Response(null, { status: 200 })
          : new Response(JSON.stringify(trail), { status: 200 })
      );
    });

    it('shows the English/360Runs brand text and logo on the 360runs.com host', async () => {
      const { text, imgSrcs } = await render(makeRequest('slug=esjan-hringur', '360runs.com'));
      expect(text).toContain('360RUNS.COM');
      expect(text).not.toContain('HLAUPADAGSKRA.IS');
      expect(imgSrcs).toContain('https://360runs.com/icons/360runs-icon-512.png');
    });

    it('shows the unchanged Icelandic brand text and logo on the hlaupadagskra.is host', async () => {
      const { text, imgSrcs } = await render(makeRequest('slug=esjan-hringur', 'www.hlaupadagskra.is'));
      expect(text).toContain('HLAUPADAGSKRA.IS');
      expect(imgSrcs).toContain('https://www.hlaupadagskra.is/icons/hlaupadagskra-icon-512.png');
    });

    it('falls back to the Icelandic brand text and logo on an unknown host (preview deploys)', async () => {
      const { text, imgSrcs } = await render(makeRequest('slug=esjan-hringur', 'some-preview.vercel.app'));
      expect(text).toContain('HLAUPADAGSKRA.IS');
      expect(imgSrcs).toContain('https://some-preview.vercel.app/icons/hlaupadagskra-icon-512.png');
    });

    it('preflights the logo with a HEAD request, not GET, to avoid downloading the full PNG body', async () => {
      const methods: (string | undefined)[] = [];
      stubFetch((url, init) => {
        if (isLogoRequest(url)) {
          methods.push(init?.method);
          return new Response(null, { status: 200 });
        }
        return new Response(JSON.stringify(trail), { status: 200 });
      });
      await render(makeRequest('slug=esjan-hringur', '360runs.com'));
      expect(methods).toEqual(['HEAD']);
    });

    it('falls back to the 🏃 emoji, with no img element, when the logo preflight fetch fails', async () => {
      stubFetch((url) =>
        isLogoRequest(url)
          ? Promise.reject(new Error('network down'))
          : Promise.resolve(new Response(JSON.stringify(trail), { status: 200 }))
      );
      const { text, imgSrcs } = await render(makeRequest('slug=esjan-hringur', '360runs.com'));
      expect(text).toContain('🏃');
      expect(imgSrcs).toEqual([]);
    });

    it('falls back to the 🏃 emoji, with no img element, when the logo preflight fetch is non-ok', async () => {
      stubFetch((url) =>
        isLogoRequest(url)
          ? new Response(null, { status: 404 })
          : new Response(JSON.stringify(trail), { status: 200 })
      );
      const { text, imgSrcs } = await render(makeRequest('slug=esjan-hringur', '360runs.com'));
      expect(text).toContain('🏃');
      expect(imgSrcs).toEqual([]);
    });
  });

  describe('defaultImage() branch', () => {
    it('no-slug request: shows English heading/tagline and logo on the 360runs.com host', async () => {
      stubFetch((url) => (isLogoRequest(url) ? new Response(null, { status: 200 }) : new Response(null, { status: 404 })));
      const { text, imgSrcs } = await render(makeRequest('', '360runs.com'));
      expect(text).toContain('360Runs');
      expect(text).toContain('All running events in one place');
      expect(imgSrcs).toContain('https://360runs.com/icons/360runs-icon-512.png');
    });

    it('no-slug request: unchanged Icelandic heading/tagline and logo on the hlaupadagskra.is host', async () => {
      stubFetch((url) => (isLogoRequest(url) ? new Response(null, { status: 200 }) : new Response(null, { status: 404 })));
      const { text, imgSrcs } = await render(makeRequest('', 'www.hlaupadagskra.is'));
      expect(text).toContain('Hlaupadagskra.is');
      expect(text).toContain('Öll hlaup á einum stað');
      expect(imgSrcs).toContain('https://www.hlaupadagskra.is/icons/hlaupadagskra-icon-512.png');
    });

    it('failed backend fetch (non-ok response): varies by host too', async () => {
      stubFetch((url) => (isLogoRequest(url) ? new Response(null, { status: 200 }) : new Response(null, { status: 500 })));
      const { text, imgSrcs } = await render(makeRequest('slug=missing-trail', '360runs.com'));
      expect(text).toContain('360Runs');
      expect(text).toContain('All running events in one place');
      expect(imgSrcs).toContain('https://360runs.com/icons/360runs-icon-512.png');
    });

    it('thrown fetch error: degrades gracefully to the 🏃 emoji rather than throwing', async () => {
      // Every fetch call throws here — including logoUrl()'s own preflight —
      // which is exactly the "network hiccup" scenario #1221 asks to be
      // verified: the response still renders, just without the logo image.
      stubFetch(() => {
        throw new Error('network down');
      });
      const request = makeRequest('slug=missing-trail', '360runs.com');
      const { text, imgSrcs } = await render(request);
      expect(text).toContain('360Runs');
      expect(text).toContain('🏃');
      expect(text).toContain('All running events in one place');
      expect(imgSrcs).toEqual([]);
    });
  });
});

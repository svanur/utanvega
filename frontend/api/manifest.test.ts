import { describe, it, expect } from 'vitest';
import handler from './manifest';

/**
 * Same request shape as api/og.test.ts: the public hostname arrives via
 * x-forwarded-host, mirroring the /manifest.webmanifest rewrite in
 * frontend/vercel.json.
 */
function makeRequest(host: string): Request {
  return new Request('https://internal.vercel.app/api/manifest', {
    headers: { 'x-forwarded-host': host },
  });
}

async function json(res: Response) {
  return res.json();
}

describe('manifest.ts per-host PWA identity', () => {
  it('serves the existing Icelandic identity on hlaupadagskra.is, unchanged from before #1033', async () => {
    const body = await json(await handler(makeRequest('www.hlaupadagskra.is')));
    expect(body.name).toBe('Hlaupadagskra.is');
    expect(body.short_name).toBe('Hlaupadagskrá');
    expect(body.description).toBe('Öll hlaup á einum stað');
    expect(body.lang).toBe('is');
  });

  it('serves the 360Runs identity on 360runs.com', async () => {
    const body = await json(await handler(makeRequest('360runs.com')));
    expect(body.name).toBe('360Runs');
    expect(body.short_name).toBe('360Runs');
    expect(body.description).toBe('All trail races in one place');
    expect(body.lang).toBe('en');
  });

  it('falls back to the Icelandic identity for hosts with no HOST_LOCALES entry', async () => {
    const body = await json(await handler(makeRequest('some-preview.vercel.app')));
    expect(body.name).toBe('Hlaupadagskra.is');
    expect(body.lang).toBe('is');
  });

  it('keeps icons, theme_color and start_url identical across hosts', async () => {
    const [is, en] = await Promise.all([
      json(await handler(makeRequest('hlaupadagskra.is'))),
      json(await handler(makeRequest('360runs.com'))),
    ]);
    expect(en.icons).toEqual(is.icons);
    expect(en.theme_color).toBe(is.theme_color);
    expect(en.background_color).toBe(is.background_color);
    expect(en.display).toBe(is.display);
    expect(en.start_url).toBe(is.start_url);
    expect(en.scope).toBe(is.scope);
    expect(en.shortcuts).toEqual(is.shortcuts);

    expect(is.start_url).toBe('/');
    expect(is.theme_color).toBe('#1976d2');
    expect(is.icons).toEqual([
      { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
      {
        src: 'icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ]);
  });

  it('responds with the manifest content type', async () => {
    const res = await handler(makeRequest('hlaupadagskra.is'));
    expect(res.headers.get('Content-Type')).toBe('application/manifest+json');
  });
});

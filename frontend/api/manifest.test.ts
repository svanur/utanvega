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

async function json(res: Response): Promise<any> {
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
    expect(body.description).toBe('All running events in one place');
    expect(body.lang).toBe('en');
  });

  it('falls back to the Icelandic identity for hosts with no HOST_LOCALES entry', async () => {
    const body = await json(await handler(makeRequest('some-preview.vercel.app')));
    expect(body.name).toBe('Hlaupadagskra.is');
    expect(body.lang).toBe('is');
  });

  it('keeps theme_color and start_url identical across hosts, but serves each host its own brand icons/shortcuts (#1080)', async () => {
    const [is, en] = await Promise.all([
      json(await handler(makeRequest('hlaupadagskra.is'))),
      json(await handler(makeRequest('360runs.com'))),
    ]);
    expect(en.theme_color).toBe(is.theme_color);
    expect(en.background_color).toBe(is.background_color);
    expect(en.display).toBe(is.display);
    expect(en.start_url).toBe(is.start_url);
    expect(en.scope).toBe(is.scope);

    // Icons/shortcuts are per-brand, not shared (#1080) — IS gets the
    // Hlaupadagskra ring, EN gets the 360Runs one, never the other's.
    expect(is.icons).not.toEqual(en.icons);
    expect(is.shortcuts).not.toEqual(en.shortcuts);

    expect(is.start_url).toBe('/');
    expect(is.theme_color).toBe('#1976d2');
    expect(is.icons).toEqual([
      { src: 'icons/hlaupadagskra-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/hlaupadagskra-icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icons/hlaupadagskra-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ]);
    expect(en.icons).toEqual([
      { src: 'icons/360runs-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/360runs-icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icons/360runs-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ]);
  });

  it('responds with the manifest content type', async () => {
    const res = await handler(makeRequest('hlaupadagskra.is'));
    expect(res.headers.get('Content-Type')).toBe('application/manifest+json');
  });
});

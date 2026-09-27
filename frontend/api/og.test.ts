import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './og';

/**
 * Mirrors the request shape og.ts actually receives in production: Vercel's
 * bot-UA rewrite (frontend/vercel.json) invokes this function internally, so
 * the public hostname the crawler asked for arrives via x-forwarded-host, not
 * the request URL's own host — same pattern as frontend/api/_site.test.ts.
 */
function makeRequest(query: string, host: string): Request {
  return new Request(`https://internal.vercel.app/api/og?${query}`, {
    headers: { 'x-forwarded-host': host },
  });
}

async function html(res: Response): Promise<string> {
  return res.text();
}

describe('og.ts locale-aware crawler surface', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('ROUTE_META static pages', () => {
    it('serves Icelandic copy on hlaupadagskra.is, unchanged from before #1032', async () => {
      const body = await html(await handler(makeRequest('path=trails', 'www.hlaupadagskra.is')));
      expect(body).toContain('<html lang="is">');
      expect(body).toContain('<title>Leiðir | Hlaupadagskra.is</title>');
      expect(body).toContain('property="og:locale" content="is_IS"');
      expect(body).toContain('property="og:locale:alternate" content="en_US"');
      expect(body).toContain('property="og:site_name" content="Hlaupadagskra.is"');
    });

    it('serves English copy on 360runs.com', async () => {
      const body = await html(await handler(makeRequest('path=trails', '360runs.com')));
      expect(body).toContain('<html lang="en">');
      expect(body).toContain('<title>Trails | 360Runs</title>');
      expect(body).toContain('property="og:locale" content="en_US"');
      expect(body).toContain('property="og:locale:alternate" content="is_IS"');
      expect(body).toContain('property="og:site_name" content="360Runs"');
    });

    it('translates every ROUTE_META route, not just one', async () => {
      const routes: [string, string][] = [
        ['/events', 'Events'],
        ['/compare', 'Compare trails'],
        ['/locations', 'Locations'],
        ['/tools', 'Running tools'],
        ['/itra', 'ITRA'],
        ['/fun', 'Fun'],
        ['/services', 'Services'],
        ['/about', 'About'],
        ['/faq', 'FAQ'],
      ];
      for (const [path, titleEn] of routes) {
        const body = await html(
          await handler(makeRequest(`path=${path.slice(1)}`, '360runs.com'))
        );
        expect(body).toContain(`<title>${titleEn} | 360Runs</title>`);
      }
    });

    it('falls back to the Icelandic default page on an unknown host (preview deploys)', async () => {
      const body = await html(
        await handler(makeRequest('path=trails', 'some-preview.vercel.app'))
      );
      expect(body).toContain('<html lang="is">');
      expect(body).toContain('<title>Leiðir | Hlaupadagskra.is</title>');
    });
  });

  describe('reciprocal hreflang', () => {
    it('emits is/en/x-default alternates that swap only the domain', async () => {
      const body = await html(await handler(makeRequest('path=events', 'www.360runs.com')));
      expect(body).toContain(
        '<link rel="alternate" hreflang="is" href="https://www.hlaupadagskra.is/events" />'
      );
      expect(body).toContain(
        '<link rel="alternate" hreflang="en" href="https://www.360runs.com/events" />'
      );
      expect(body).toContain(
        '<link rel="alternate" hreflang="x-default" href="https://www.hlaupadagskra.is/events" />'
      );
    });

    it('points the reciprocal is alternate back at the Icelandic host', async () => {
      const body = await html(
        await handler(makeRequest('path=events', 'hlaupadagskra.is'))
      );
      expect(body).toContain(
        '<link rel="alternate" hreflang="is" href="https://hlaupadagskra.is/events" />'
      );
      expect(body).toContain(
        '<link rel="alternate" hreflang="en" href="https://360runs.com/events" />'
      );
    });

    it('omits hreflang entirely on hosts outside HOST_LOCALES', async () => {
      const body = await html(
        await handler(makeRequest('path=events', 'some-preview.vercel.app'))
      );
      expect(body).not.toContain('hreflang');
    });
  });

  describe('trail pages (handler() trail branch)', () => {
    const trail = {
      name: 'Esjan hringur',
      nameEn: 'Esja Loop',
      slug: 'esjan-hringur',
      description: 'Falleg leið um Esjuna.',
      descriptionEn: 'A beautiful loop around Mt. Esja.',
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

    it('uses nameEn/descriptionEn on the English host', async () => {
      const body = await html(
        await handler(makeRequest('slug=esjan-hringur', '360runs.com'))
      );
      expect(body).toContain('<h1>Esja Loop</h1>');
      expect(body).toContain('A beautiful loop around Mt. Esja.');
      expect(body).toContain('<html lang="en">');
    });

    it('keeps the Icelandic fields on the Icelandic host, unchanged', async () => {
      const body = await html(
        await handler(makeRequest('slug=esjan-hringur', 'www.hlaupadagskra.is'))
      );
      expect(body).toContain('<h1>Esjan hringur</h1>');
      expect(body).toContain('Falleg leið um Esjuna.');
      expect(body).toContain('<html lang="is">');
    });

    it('falls back to the Icelandic name/description when the English fields are blank', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ ...trail, nameEn: '', descriptionEn: null }), {
              status: 200,
            })
        )
      );
      const body = await html(
        await handler(makeRequest('slug=esjan-hringur', '360runs.com'))
      );
      expect(body).toContain('<h1>Esjan hringur</h1>');
      expect(body).toContain('Falleg leið um Esjuna.');
    });
  });

  describe('entity pages (entityPage() — /events/:slug, /locations/:slug)', () => {
    const event = {
      name: 'Reykjavíkurmaraþon',
      nameEn: 'Reykjavik Marathon',
      description: 'Stærsta hlaup Íslands.',
      descriptionEn: 'The biggest race in Iceland.',
    };

    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(event), { status: 200 }))
      );
    });

    it('uses nameEn/descriptionEn on the English host', async () => {
      const body = await html(
        await handler(makeRequest('path=events/reykjavikurmarathon', '360runs.com'))
      );
      expect(body).toContain('<h1>Reykjavik Marathon</h1>');
      expect(body).toContain('The biggest race in Iceland.');
    });

    it('keeps the Icelandic fields on the Icelandic host, unchanged', async () => {
      const body = await html(
        await handler(makeRequest('path=events/reykjavikurmarathon', 'www.hlaupadagskra.is'))
      );
      expect(body).toContain('<h1>Reykjavíkurmaraþon</h1>');
      expect(body).toContain('Stærsta hlaup Íslands.');
    });

    it('falls back to the Icelandic name/description when English is null', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ ...event, nameEn: null, descriptionEn: null }), {
              status: 200,
            })
        )
      );
      const body = await html(
        await handler(makeRequest('path=events/reykjavikurmarathon', '360runs.com'))
      );
      expect(body).toContain('<h1>Reykjavíkurmaraþon</h1>');
      expect(body).toContain('Stærsta hlaup Íslands.');
    });
  });
});

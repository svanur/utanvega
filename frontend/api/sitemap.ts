export const config = { runtime: 'edge' };

import { siteOrigin, esc } from './_site';

declare const process: { env: Record<string, string | undefined> };

const BACKEND_URL =
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://backend-wispy-forest-1686.fly.dev';

/** Static routes worth indexing, mirroring ROUTE_META in og.ts. */
const STATIC_PATHS = [
  { path: '', priority: '1.0', changefreq: 'daily' },
  { path: '/events', priority: '0.9', changefreq: 'daily' },
  { path: '/trails', priority: '0.9', changefreq: 'weekly' },
  { path: '/locations', priority: '0.7', changefreq: 'weekly' },
  { path: '/compare', priority: '0.6', changefreq: 'monthly' },
  { path: '/tools', priority: '0.6', changefreq: 'monthly' },
  { path: '/itra', priority: '0.5', changefreq: 'monthly' },
  { path: '/fun', priority: '0.4', changefreq: 'monthly' },
  { path: '/services', priority: '0.4', changefreq: 'monthly' },
  { path: '/about', priority: '0.4', changefreq: 'monthly' },
  { path: '/faq', priority: '0.4', changefreq: 'monthly' },
];

interface Slugged {
  slug?: string;
}

/** Collections whose detail pages are indexable, each listed from the backend. */
const COLLECTIONS = [
  { endpoint: 'trails', path: 'trails', priority: '0.8' },
  { endpoint: 'events', path: 'events', priority: '0.8' },
  { endpoint: 'locations', path: 'locations', priority: '0.6' },
];

function urlEntry(loc: string, priority: string, changefreq: string) {
  return `  <url>
    <loc>${esc(loc)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Served at /sitemap.xml via a rewrite in vercel.json.
 *
 * Trail URLs are pulled from the backend at request time rather than generated
 * at build time, so newly published trails appear without a redeploy.
 */
export default async function handler(request: Request) {
  const origin = siteOrigin(request);

  const entries = STATIC_PATHS.map(({ path, priority, changefreq }) =>
    urlEntry(`${origin}${path}`, priority, changefreq)
  );

  // A sitemap missing some detail URLs is still valid and useful, so a backend
  // outage degrades to whatever was fetched rather than failing the response.
  // Collections are fetched together; one failing does not block the others.
  const collections = await Promise.all(
    COLLECTIONS.map(async ({ endpoint, path, priority }) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/${endpoint}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return [];
        const items = (await res.json()) as Slugged[];
        if (!Array.isArray(items)) return [];
        return items
          .filter((item) => item.slug)
          .map((item) =>
            urlEntry(`${origin}/${path}/${encodeURIComponent(item.slug!)}`, priority, 'monthly')
          );
      } catch {
        return [];
      }
    })
  );
  for (const group of collections) entries.push(...group);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

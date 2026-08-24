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

interface TrailSummary {
  slug?: string;
}

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

  // A sitemap missing its trail URLs is still valid and useful, so a backend
  // outage degrades to the static routes rather than failing the whole response.
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/trails`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const trails = (await res.json()) as TrailSummary[];
      for (const trail of trails) {
        if (!trail.slug) continue;
        entries.push(
          urlEntry(`${origin}/trails/${encodeURIComponent(trail.slug)}`, '0.8', 'monthly')
        );
      }
    }
  } catch {
    // Fall through with static routes only.
  }

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

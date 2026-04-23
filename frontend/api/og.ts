export const config = { runtime: 'edge' };

// Edge Functions run in a Node-like environment that provides process.env
declare const process: { env: Record<string, string | undefined> };

const BACKEND_URL =
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://backend-wispy-forest-1686.fly.dev';

const SITE_URL =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://utanvega.vercel.app');

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDistance(meters: number): string {
  return (meters / 1000).toFixed(1);
}

const ACTIVITY_LABELS: Record<string, string> = {
  TrailRunning: 'Trail Running',
  Running: 'Running',
  Hiking: 'Hiking',
  Cycling: 'Cycling',
};

interface TrailResponse {
  name: string;
  slug: string;
  description?: string;
  length: number;
  elevationGain: number;
  elevationLoss: number;
  activityType: string;
  difficulty: string;
  locations?: { name: string }[];
  tags?: { name: string }[];
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const path = url.searchParams.get('path');

  if (!slug) {
    return defaultPage(path ? `/${path}` : '');
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/trails/${encodeURIComponent(slug)}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!res.ok) {
      return defaultPage();
    }

    const trail = await res.json() as TrailResponse;
    const title = esc(trail.name);
    const distance = fmtDistance(trail.length);
    const gain = Math.round(trail.elevationGain);
    const activity = ACTIVITY_LABELS[trail.activityType] || trail.activityType;
    const canonicalUrl = `${SITE_URL}/trails/${slug}`;

    const description = trail.description
      ? esc(trail.description.slice(0, 200))
      : esc(`${distance} km ${activity.toLowerCase()} trail · ${gain}m elevation gain`);

    const locations = trail.locations?.map((l) => l.name).join(', ') || '';
    const subtitle = locations ? ` · ${esc(locations)}` : '';

    const ogTitle = `${title} – ${distance} km${subtitle}`;
    const ogImageUrl = `${SITE_URL}/api/og-image?slug=${encodeURIComponent(slug)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} – Utanvega</title>
  <meta name="description" content="${description}" />

  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="Utanvega" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="is_IS" />
  <meta property="og:locale:alternate" content="en_US" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />

  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">${title} on Utanvega</a>…</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return defaultPage();
  }
}

function defaultPage(path: string = '') {
  const canonicalUrl = path ? `${SITE_URL}${path}` : SITE_URL;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Utanvega – Hlaupaleiðir á Íslandi</title>
  <meta name="description" content="Vefur til að finna og deila skemmtilegum leiðum, hvort sem þær eru utanvega eða innanbæjar." />

  <meta property="og:title" content="Utanvega – Hlaupaleiðir á Íslandi" />
  <meta property="og:description" content="Vefur til að finna og deila skemmtilegum leiðum, hvort sem þær eru utanvega eða innanbæjar." />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="Utanvega" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${SITE_URL}/api/og-image" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Utanvega – Hlaupaleiðir á Íslandi" />
  <meta name="twitter:description" content="Vefur til að finna og deila skemmtilegum leiðum, hvort sem þær eru utanvega eða innanbæjar." />
  <meta name="twitter:image" content="${SITE_URL}/api/og-image" />

  <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">Utanvega</a>…</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}

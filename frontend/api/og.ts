export const config = { runtime: 'edge' };

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

  if (!slug) {
    return defaultPage();
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/trails/${encodeURIComponent(slug)}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!res.ok) {
      return defaultPage();
    }

    const trail: TrailResponse = await res.json();
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
  <meta property="og:locale" content="is_IS" />
  <meta property="og:locale:alternate" content="en_US" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${description}" />

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

function defaultPage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Utanvega – Trail Discovery in Iceland</title>
  <meta name="description" content="Explore and discover trails in Iceland for trail running, hiking, and cycling." />

  <meta property="og:title" content="Utanvega – Trail Discovery in Iceland" />
  <meta property="og:description" content="Explore and discover trails in Iceland for trail running, hiking, and cycling." />
  <meta property="og:url" content="${SITE_URL}" />
  <meta property="og:site_name" content="Utanvega" />
  <meta property="og:type" content="website" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Utanvega – Trail Discovery in Iceland" />
  <meta name="twitter:description" content="Explore and discover trails in Iceland for trail running, hiking, and cycling." />

  <meta http-equiv="refresh" content="0;url=${SITE_URL}" />
</head>
<body>
  <p>Redirecting to <a href="${SITE_URL}">Utanvega</a>…</p>
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

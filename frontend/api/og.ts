export const config = { runtime: 'edge' };

import { siteOrigin, esc } from './_site';

// Edge Functions run in a Node-like environment that provides process.env
declare const process: { env: Record<string, string | undefined> };

const BACKEND_URL =
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://backend-wispy-forest-1686.fly.dev';

/**
 * Titles and descriptions for the static routes. Without these every non-trail
 * URL is indexed under one identical generic title, which suppresses ranking
 * for all of them. Icelandic, to match the site's default locale (og:locale is
 * is_IS) — the crawler response carries no language preference to switch on.
 */
const ROUTE_META: Record<string, { title: string; description: string }> = {
  '/events': {
    title: 'Viðburðir',
    description:
      'Öll skráð hlaup og viðburðir á Íslandi — götuhlaup, utanvegahlaup, fjallahlaup og skemmtiskokk. Leitaðu eftir dagsetningu, vegalengd og staðsetningu.',
  },
  '/trails': {
    title: 'Leiðir',
    description:
      'Hlaupaleiðir um allt Ísland með vegalengd, hækkun, erfiðleikastigi og GPX-skrám til niðurhals.',
  },
  '/compare': {
    title: 'Bera saman leiðir',
    description:
      'Berðu tvær leiðir saman hlið við hlið og sjáðu muninn á vegalengd, hækkun, erfiðleikastigi og undirlagi — gagnlegt þegar þú velur næstu leið eða metur keppni.',
  },
  '/locations': {
    title: 'Staðsetningar',
    description:
      'Skoðaðu hlaupaleiðir eftir landshlutum og sveitarfélögum um allt Ísland.',
  },
  '/tools': {
    title: 'Hlaupatól',
    description:
      'Reiknivélar og tól fyrir hlaupara — tímaspá, aldursleiðrétting, hraðatafla og fleira.',
  },
  '/itra': {
    title: 'ITRA',
    description:
      'Upplýsingar um ITRA-stig, alþjóðlega flokkun utanvegahlaupa og hvernig stigin eru reiknuð.',
  },
  '/fun': {
    title: 'Gaman',
    description: 'Skemmtiefni, tölfræði og fróðleikur fyrir hlaupara.',
  },
  '/services': {
    title: 'Þjónusta',
    description: 'Þjónusta Hlaupadagskra.is fyrir hlaupara og mótshaldara.',
  },
  '/about': {
    title: 'Um okkur',
    description: 'Um Hlaupadagskra.is — hverjir standa að vefnum og hvers vegna.',
  },
  '/faq': {
    title: 'Algengar spurningar',
    description: 'Svör við algengum spurningum um Hlaupadagskra.is.',
  },
};

function fmtDistance(meters: number): string {
  return (meters / 1000).toFixed(1);
}

const ACTIVITY_LABELS: Record<string, string> = {
  TrailRunning: 'Trail Run',
  Running: 'Road Run',
  Hiking: 'Hike',
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

interface NamedEntity {
  name?: string;
  nameEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
}

/**
 * Detail pages that carry their own name and description from the backend.
 * Without these, /events/:slug and /locations/:slug — the URLs people actually
 * search for by name — are indexed under the generic site title.
 */
const ENTITY_ROUTES: Record<
  string,
  { endpoint: string; suffix: string; unwrap?: string }
> = {
  events: { endpoint: 'events', suffix: '' },
  // This endpoint answers { location, childLocations, trails } rather than the
  // entity itself, so the entity has to be lifted out of the envelope.
  locations: { endpoint: 'locations', suffix: ' — hlaupaleiðir', unwrap: 'location' },
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const path = url.searchParams.get('path');
  const origin = siteOrigin(request);

  if (!slug) {
    // "events/reykjavikurmarathon" → segments ["events", "reykjavikurmarathon"]
    const segments = (path || '').split('?')[0].split('/').filter(Boolean);
    if (segments.length === 2 && ENTITY_ROUTES[segments[0]]) {
      return entityPage(origin, segments[0], segments[1]);
    }
    return defaultPage(origin, path ? `/${path}` : '');
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/trails/${encodeURIComponent(slug)}`,
      { headers: { Accept: 'application/json' } }
    );

    // Encoded on every branch, so the canonical a 404 advertises is byte-identical
    // to the one the same URL gets once the trail exists.
    const trailPath = `/trails/${encodeURIComponent(slug)}`;

    if (res.status === 404) {
      // A 200 on a missing trail is a soft 404 that wastes crawl budget.
      return defaultPage(origin, trailPath, 404);
    }
    if (!res.ok) {
      return defaultPage(origin, trailPath);
    }

    const trail = await res.json() as TrailResponse;
    const distance = fmtDistance(trail.length);
    const gain = Math.round(trail.elevationGain);
    const activity = ACTIVITY_LABELS[trail.activityType] || trail.activityType;

    const description = trail.description
      ? trail.description.slice(0, 200)
      : `${distance} km ${activity.toLowerCase()} trail · ${gain}m elevation gain`;

    const locations = trail.locations?.map((l) => l.name).join(', ') || '';
    const subtitle = locations ? ` · ${locations}` : '';

    return htmlPage({
      origin,
      canonicalPath: trailPath,
      title: `${trail.name} – Hlaupadagskra.is`,
      ogTitle: `${trail.name} – ${distance} km${subtitle}`,
      heading: trail.name,
      description,
      ogImagePath: `/api/og-image?slug=${encodeURIComponent(slug)}`,
    });
  } catch {
    return defaultPage(origin, `/trails/${encodeURIComponent(slug)}`);
  }
}

/**
 * Paths that must never be indexed. robots.txt disallows them too, but a
 * disallowed URL can still be indexed from an external link — only a noindex
 * response keeps it out, and a crawler has to be allowed to read the page to
 * see that. These are served noindex rather than being blocked outright.
 */
const NOINDEX_PATHS = new Set(['/changelog-diary']);

const SITE_TITLE = 'Hlaupadagskra.is – Öll hlaup á einum stað';
const SITE_DESCRIPTION =
  'Vefur til að finna og deila skemmtilegum leiðum, hvort sem þær eru utanvega eða innanbæjar.';

/**
 * Renders /events/:slug and /locations/:slug from backend data.
 * Falls back to the generic page if the entity cannot be fetched, and returns
 * 404 when the backend says it does not exist — a 200 on a missing entity is a
 * soft 404 that wastes crawl budget.
 */
async function entityPage(origin: string, kind: string, slug: string) {
  const route = ENTITY_ROUTES[kind];
  const canonicalPath = `/${kind}/${encodeURIComponent(slug)}`;

  let entity: NamedEntity | null = null;
  let missing = false;

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/${route.endpoint}/${encodeURIComponent(slug)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.status === 404) {
      missing = true;
    } else if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>;
      entity = (route.unwrap ? body?.[route.unwrap] : body) as NamedEntity | null;
    }
  } catch {
    // Backend unreachable — fall through to the generic page below.
  }

  if (missing) {
    return defaultPage(origin, canonicalPath, 404);
  }
  if (!entity?.name) {
    return defaultPage(origin, canonicalPath);
  }

  const name = entity.name;
  const description =
    (entity.description || '').trim() ||
    `${name} — á Hlaupadagskra.is.`;

  return htmlPage({
    origin,
    canonicalPath,
    title: `${name} | Hlaupadagskra.is`,
    ogTitle: `${name}${route.suffix}`,
    heading: name,
    description: description.slice(0, 200),
    ogImagePath: '/api/og-image',
  });
}

/** Single place that builds the crawler-facing HTML, so every route agrees. */
function htmlPage(opts: {
  origin: string;
  canonicalPath: string;
  title: string;
  ogTitle: string;
  heading: string;
  description: string;
  ogImagePath: string;
  status?: number;
}) {
  const canonicalUrl = esc(
    opts.canonicalPath ? `${opts.origin}${opts.canonicalPath}` : opts.origin
  );
  const title = esc(opts.title);
  const ogTitle = esc(opts.ogTitle);
  const heading = esc(opts.heading);
  const description = esc(opts.description);
  const ogImageUrl = esc(`${opts.origin}${opts.ogImagePath}`);
  const robots = NOINDEX_PATHS.has(opts.canonicalPath)
    ? '\n  <meta name="robots" content="noindex, nofollow" />'
    : '';

  const html = `<!DOCTYPE html>
<html lang="is">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonicalUrl}" />${robots}

  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="Hlaupadagskra.is" />
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
</head>
<body>
  <h1>${heading}</h1>
  <p>${description}</p>
  <p><a href="${canonicalUrl}">${heading} á Hlaupadagskra.is</a></p>
</body>
</html>`;

  const status = opts.status ?? 200;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cacheControlFor(status),
    },
  });
}

/**
 * A 404 is a statement about "right now" — the event may be published a minute
 * later. Caching it publicly for an hour would keep serving the 404 from the
 * edge long after the page exists, so misses get a short window only.
 */
function cacheControlFor(status: number): string {
  return status === 200
    ? 'public, s-maxage=3600, stale-while-revalidate=86400'
    : 'public, s-maxage=60';
}

function defaultPage(origin: string, path: string = '', status: number = 200) {
  // Only the path forms the canonical, so every /compare?a=…&b=… permutation
  // consolidates onto /compare rather than becoming its own indexable URL.
  const cleanPath = path.split('?')[0].replace(/\/+$/, '');
  const meta = ROUTE_META[cleanPath];

  return htmlPage({
    origin,
    canonicalPath: cleanPath,
    title: meta ? `${meta.title} | Hlaupadagskra.is` : SITE_TITLE,
    ogTitle: meta ? `${meta.title} | Hlaupadagskra.is` : SITE_TITLE,
    heading: meta ? meta.title : 'Hlaupadagskra.is',
    description: meta ? meta.description : SITE_DESCRIPTION,
    ogImagePath: '/api/og-image',
    status,
  });
}

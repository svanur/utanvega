export const config = { runtime: 'edge' };

import { siteOrigin, esc, resolveLocale, HOST_LOCALES, type Locale } from './_site';

// Edge Functions run in a Node-like environment that provides process.env
declare const process: { env: Record<string, string | undefined> };

const BACKEND_URL =
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://backend-wispy-forest-1686.fly.dev';

/**
 * Titles and descriptions for the static routes. Without these every non-trail
 * URL is indexed under one identical generic title, which suppresses ranking
 * for all of them. Icelandic and English copy live side by side here — the
 * locale served is resolved from the request's host (see resolveLocale()),
 * since the crawler response itself carries no language preference to switch on.
 */
const ROUTE_META: Record<
  string,
  { title: string; description: string; titleEn: string; descriptionEn: string }
> = {
  '/events': {
    title: 'Viðburðir',
    description:
      'Öll skráð hlaup og viðburðir á Íslandi — götuhlaup, utanvegahlaup, fjallahlaup og skemmtiskokk. Leitaðu eftir dagsetningu, vegalengd og staðsetningu.',
    titleEn: 'Events',
    descriptionEn:
      'Every registered race and event in Iceland — road runs, trail runs, mountain runs and fun runs. Search by date, distance and location.',
  },
  '/trails': {
    title: 'Leiðir',
    description:
      'Hlaupaleiðir um allt Ísland með vegalengd, hækkun, erfiðleikastigi og GPX-skrám til niðurhals.',
    titleEn: 'Trails',
    descriptionEn:
      'Running trails all over Iceland with distance, elevation gain, difficulty rating and downloadable GPX files.',
  },
  '/compare': {
    title: 'Bera saman leiðir',
    description:
      'Berðu tvær leiðir saman hlið við hlið og sjáðu muninn á vegalengd, hækkun, erfiðleikastigi og undirlagi — gagnlegt þegar þú velur næstu leið eða metur keppni.',
    titleEn: 'Compare trails',
    descriptionEn:
      'Compare two trails side by side and see the difference in distance, elevation gain, difficulty and surface — useful when picking your next trail or sizing up a race.',
  },
  '/locations': {
    title: 'Staðsetningar',
    description:
      'Skoðaðu hlaupaleiðir eftir landshlutum og sveitarfélögum um allt Ísland.',
    titleEn: 'Locations',
    descriptionEn: 'Browse running trails by region and municipality across Iceland.',
  },
  '/tools': {
    title: 'Hlaupatól',
    description:
      'Reiknivélar og tól fyrir hlaupara — tímaspá, aldursleiðrétting, hraðatafla og fleira.',
    titleEn: 'Running tools',
    descriptionEn:
      'Calculators and tools for runners — race time predictor, age grading, pace chart and more.',
  },
  '/itra': {
    title: 'ITRA',
    description:
      'Upplýsingar um ITRA-stig, alþjóðlega flokkun utanvegahlaupa og hvernig stigin eru reiknuð.',
    titleEn: 'ITRA',
    descriptionEn:
      'Information about ITRA points, the international trail running ranking, and how the points are calculated.',
  },
  '/fun': {
    title: 'Gaman',
    description: 'Skemmtiefni, tölfræði og fróðleikur fyrir hlaupara.',
    titleEn: 'Fun',
    descriptionEn: 'Fun content, stats and trivia for runners.',
  },
  '/services': {
    title: 'Þjónusta',
    description: 'Þjónusta Hlaupadagskra.is fyrir hlaupara og mótshaldara.',
    titleEn: 'Services',
    descriptionEn: '360Runs services for runners and race organisers.',
  },
  '/about': {
    title: 'Um okkur',
    description: 'Um Hlaupadagskra.is — hverjir standa að vefnum og hvers vegna.',
    titleEn: 'About',
    descriptionEn: 'About 360Runs — who is behind the site and why.',
  },
  '/faq': {
    title: 'Algengar spurningar',
    description: 'Svör við algengum spurningum um Hlaupadagskra.is.',
    titleEn: 'FAQ',
    descriptionEn: 'Answers to frequently asked questions about 360Runs.',
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
  nameEn?: string | null;
  slug: string;
  description?: string;
  descriptionEn?: string | null;
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
 * Picks the English copy over the Icelandic one only when English is present
 * on an English-locale request — falls back to the Icelandic field otherwise,
 * so a not-yet-translated entity renders existing copy rather than blank text.
 */
function pickLocalized(locale: Locale, base: string, en?: string | null): string {
  if (locale === 'en' && en && en.trim()) return en.trim();
  return base;
}

/** The HOST_LOCALES host that serves `locale`, or null if none does. */
function hostForLocale(locale: Locale): string | null {
  const entry = Object.entries(HOST_LOCALES).find(([, l]) => l === locale);
  return entry ? entry[0] : null;
}

/**
 * The is/en hreflang alternates for canonicalPath on the current origin.
 *
 * Slugs are identical across hosts, so this is a straight domain swap rather
 * than a per-route path mapping: the current hostname's HOST_LOCALES suffix is
 * replaced with the other locale's host, keeping whatever subdomain (e.g.
 * "www.") the request actually used. Returns null when the current host isn't
 * one of the known production hosts (localhost, preview deploys) — there is
 * nothing sane to swap to there.
 */
function hreflangAlternates(
  origin: string,
  canonicalPath: string
): { is: string; en: string } | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  const currentSuffix = Object.keys(HOST_LOCALES).find(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
  if (!currentSuffix) return null;

  const prefix = hostname.slice(0, hostname.length - currentSuffix.length);
  const urlFor = (locale: Locale): string | null => {
    const targetSuffix = hostForLocale(locale);
    return targetSuffix ? `${url.protocol}//${prefix}${targetSuffix}${canonicalPath}` : null;
  };

  const isUrl = urlFor('is');
  const enUrl = urlFor('en');
  return isUrl && enUrl ? { is: isUrl, en: enUrl } : null;
}

/**
 * Detail pages that carry their own name and description from the backend.
 * Without these, /events/:slug and /locations/:slug — the URLs people actually
 * search for by name — are indexed under the generic site title.
 */
const ENTITY_ROUTES: Record<
  string,
  { endpoint: string; suffix: string; suffixEn: string; unwrap?: string }
> = {
  events: { endpoint: 'events', suffix: '', suffixEn: '' },
  // This endpoint answers { location, childLocations, trails } rather than the
  // entity itself, so the entity has to be lifted out of the envelope.
  locations: {
    endpoint: 'locations',
    suffix: ' — hlaupaleiðir',
    suffixEn: ' — trails',
    unwrap: 'location',
  },
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const path = url.searchParams.get('path');
  const origin = siteOrigin(request);
  const locale = resolveLocale(request);

  if (!slug) {
    // "events/reykjavikurmarathon" → segments ["events", "reykjavikurmarathon"]
    const segments = (path || '').split('?')[0].split('/').filter(Boolean);
    if (segments.length === 2 && ENTITY_ROUTES[segments[0]]) {
      return entityPage(origin, segments[0], segments[1], locale);
    }
    return defaultPage(origin, path ? `/${path}` : '', locale);
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
      return defaultPage(origin, trailPath, locale, 404);
    }
    if (!res.ok) {
      return defaultPage(origin, trailPath, locale);
    }

    const trail = await res.json() as TrailResponse;
    const distance = fmtDistance(trail.length);
    const gain = Math.round(trail.elevationGain);
    const activity = ACTIVITY_LABELS[trail.activityType] || trail.activityType;

    const name = pickLocalized(locale, trail.name, trail.nameEn);
    const descriptionSource = pickLocalized(locale, trail.description || '', trail.descriptionEn);
    const description = descriptionSource
      ? descriptionSource.slice(0, 200)
      : `${distance} km ${activity.toLowerCase()} trail · ${gain}m elevation gain`;

    const locations = trail.locations?.map((l) => l.name).join(', ') || '';
    const subtitle = locations ? ` · ${locations}` : '';
    const siteName = locale === 'en' ? '360Runs' : 'Hlaupadagskra.is';

    return htmlPage({
      origin,
      canonicalPath: trailPath,
      title: `${name} – ${siteName}`,
      ogTitle: `${name} – ${distance} km${subtitle}`,
      heading: name,
      description,
      ogImagePath: `/api/og-image?slug=${encodeURIComponent(slug)}`,
      locale,
    });
  } catch {
    return defaultPage(origin, `/trails/${encodeURIComponent(slug)}`, locale);
  }
}

/**
 * Paths that must never be indexed.
 *
 * These are served noindex and are deliberately left crawlable in robots.txt:
 * a disallowed URL can still be indexed as a bare entry when something links
 * to it, because the crawler never fetches the page and so never reads the
 * noindex. Do not add these paths to robots.txt — the two mechanisms cancel
 * each other out.
 */
const NOINDEX_PATHS = new Set(['/changelog-diary']);

const SITE_TITLE = 'Hlaupadagskra.is – Öll hlaup á einum stað';
const SITE_DESCRIPTION =
  'Vefur til að finna og deila skemmtilegum leiðum, hvort sem þær eru utanvega eða innanbæjar.';
const SITE_TITLE_EN = '360Runs – All Races in One Place';
const SITE_DESCRIPTION_EN =
  'A site for finding and sharing great running routes in Iceland, on trail or on road.';

/**
 * Renders /events/:slug and /locations/:slug from backend data.
 * Falls back to the generic page if the entity cannot be fetched, and returns
 * 404 when the backend says it does not exist — a 200 on a missing entity is a
 * soft 404 that wastes crawl budget.
 */
async function entityPage(origin: string, kind: string, slug: string, locale: Locale) {
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
    return defaultPage(origin, canonicalPath, locale, 404);
  }
  if (!entity?.name) {
    return defaultPage(origin, canonicalPath, locale);
  }

  const siteName = locale === 'en' ? '360Runs' : 'Hlaupadagskra.is';
  const name = pickLocalized(locale, entity.name, entity.nameEn);
  const description =
    pickLocalized(locale, (entity.description || '').trim(), entity.descriptionEn) ||
    (locale === 'en' ? `${name} — on ${siteName}.` : `${name} — á ${siteName}.`);
  const suffix = locale === 'en' ? route.suffixEn : route.suffix;

  return htmlPage({
    origin,
    canonicalPath,
    title: `${name} | ${siteName}`,
    ogTitle: `${name}${suffix}`,
    heading: name,
    description: description.slice(0, 200),
    ogImagePath: '/api/og-image',
    locale,
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
  locale: Locale;
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

  const locale = opts.locale;
  const siteName = locale === 'en' ? '360Runs' : 'Hlaupadagskra.is';
  const ogLocale = locale === 'en' ? 'en_US' : 'is_IS';
  const ogLocaleAlternate = locale === 'en' ? 'is_IS' : 'en_US';

  // Reciprocal hreflang: every alternate points back at every other, plus one
  // consistent x-default (the Icelandic version, the site's DEFAULT_LOCALE).
  const alternates = hreflangAlternates(opts.origin, opts.canonicalPath);
  const hreflangLinks = alternates
    ? `\n  <link rel="alternate" hreflang="is" href="${esc(alternates.is)}" />` +
      `\n  <link rel="alternate" hreflang="en" href="${esc(alternates.en)}" />` +
      `\n  <link rel="alternate" hreflang="x-default" href="${esc(alternates.is)}" />`
    : '';

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonicalUrl}" />${robots}${hreflangLinks}

  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta property="og:locale:alternate" content="${ogLocaleAlternate}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
</head>
<body>
  <h1>${heading}</h1>
  <p>${description}</p>
  <p><a href="${canonicalUrl}">${heading} ${locale === 'en' ? 'on' : 'á'} ${siteName}</a></p>
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

function defaultPage(
  origin: string,
  path: string = '',
  locale: Locale = 'is',
  status: number = 200
) {
  // Only the path forms the canonical, so every /compare?a=…&b=… permutation
  // consolidates onto /compare rather than becoming its own indexable URL.
  const cleanPath = path.split('?')[0].replace(/\/+$/, '');
  const meta = ROUTE_META[cleanPath];
  const siteName = locale === 'en' ? '360Runs' : 'Hlaupadagskra.is';
  const title = meta ? (locale === 'en' ? meta.titleEn : meta.title) : undefined;
  const description = meta
    ? locale === 'en'
      ? meta.descriptionEn
      : meta.description
    : locale === 'en'
      ? SITE_DESCRIPTION_EN
      : SITE_DESCRIPTION;

  return htmlPage({
    origin,
    canonicalPath: cleanPath,
    title: title ? `${title} | ${siteName}` : locale === 'en' ? SITE_TITLE_EN : SITE_TITLE,
    ogTitle: title ? `${title} | ${siteName}` : locale === 'en' ? SITE_TITLE_EN : SITE_TITLE,
    heading: title || siteName,
    description,
    ogImagePath: '/api/og-image',
    locale,
    status,
  });
}

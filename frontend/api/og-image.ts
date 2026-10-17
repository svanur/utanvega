import { ImageResponse } from '@vercel/og';
import type React from 'react';
import { resolveLocale, siteOrigin, BRAND_NAME, TAGLINE, type Locale } from './_site';

export const config = { runtime: 'edge' };

// Edge Functions run in a Node-like environment that provides process.env
declare const process: { env: Record<string, string | undefined> };

const BACKEND_URL =
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://backend-wispy-forest-1686.fly.dev';

// Helper to build virtual elements without JSX
function h(
  type: string,
  style: Record<string, unknown>,
  ...children: (string | Record<string, unknown>)[]
): Record<string, unknown> {
  return {
    type,
    props: {
      style,
      children: children.length === 1 ? children[0] : children,
    },
  };
}

const ACTIVITY_EMOJI: Record<string, string> = {
  TrailRunning: '🏃‍♂️',
  Running: '🏃',
  Hiking: '🥾',
  Cycling: '🚴',
};

const ACTIVITY_LABELS: Record<string, string> = {
  TrailRunning: 'Trail Run',
  Running: 'Road Run',
  Hiking: 'Hike',
  Cycling: 'Cycling',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4CAF50',
  Moderate: '#FF9800',
  Hard: '#f44336',
  Expert: '#9C27B0',
};

/**
 * Top-bar brand label per locale — derived from _site.ts's BRAND_NAME (#1096),
 * uppercased and suffixed to read as the domain (360Runs has no ".com" of its
 * own the way Hlaupadagskra.is already carries its ".is"). Used to carry a
 * leading 🏃 emoji baked into the string itself; that emoji is now the
 * BRAND_FALLBACK_EMOJI rendered next to the real ring logo image (#1221).
 */
const BRAND_LABEL: Record<Locale, string> = {
  is: BRAND_NAME.is.toUpperCase(),
  en: `${BRAND_NAME.en.toUpperCase()}.COM`,
};

/** defaultImage() heading per locale — same shared BRAND_NAME, no further decoration. */
const BRAND_HEADING: Record<Locale, string> = {
  is: BRAND_NAME.is,
  en: BRAND_NAME.en,
};

/**
 * Per-host ring-logo PNG that now sits next to BRAND_LABEL/BRAND_HEADING
 * instead of the emoji they used to carry (#1221). Same already-committed
 * artwork pwaManifestFields.ts's ICON_STEMS keys for the PWA
 * manifest/install banner (#1080) — reused here rather than duplicated or
 * re-generated. Built into an absolute URL via siteOrigin(request), since
 * @vercel/og's `<img>` fetches its `src` over the network at render time —
 * a relative path has nothing to resolve against there.
 */
const LOGO_PATH: Record<Locale, string> = {
  is: 'icons/hlaupadagskra-icon-512.png',
  en: 'icons/360runs-icon-512.png',
};

/** Glyph shown instead of the logo image when logoUrl() can't confirm it's reachable. */
const BRAND_FALLBACK_EMOJI = '🏃';

/**
 * Confirms the per-host logo is actually reachable before handing its URL to
 * @vercel/og's `<img>`. This matters because satori/resvg fetch that URL
 * themselves, *inside* the ReadableStream that the ImageResponse constructor
 * returns synchronously (see node_modules/@vercel/og/dist/index.js's `p`
 * class) — a failure there rejects the stream after handler() has already
 * returned, somewhere the surrounding try/catch below can no longer reach.
 * Doing our own cheap preflight fetch here — which *is* inside an awaited,
 * try/catch-guarded path — lets a network hiccup degrade to
 * BRAND_FALLBACK_EMOJI instead of corrupting the whole OG image response.
 */
async function logoUrl(locale: Locale, request: Request): Promise<string | null> {
  const url = `${siteOrigin(request)}/${LOGO_PATH[locale]}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

/** `<img>` element for the ring logo — h() only models `style`+`children`, not `src`/`width`/`height`. */
function logoImg(src: string, size: number): Record<string, unknown> {
  return {
    type: 'img',
    props: {
      src,
      width: size,
      height: size,
      style: { display: 'flex', borderRadius: '50%' },
    },
  };
}

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
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const locale = resolveLocale(request);

  if (!slug) {
    return defaultImage(locale, request);
  }

  try {
    const [res, logo] = await Promise.all([
      fetch(
        `${BACKEND_URL}/api/v1/trails/${encodeURIComponent(slug)}`,
        { headers: { Accept: 'application/json' } }
      ),
      logoUrl(locale, request),
    ]);

    if (!res.ok) {
      return defaultImage(locale, request);
    }

    const trail = await res.json() as TrailResponse;
    const distance = (trail.length / 1000).toFixed(1);
    const gain = Math.round(trail.elevationGain);
    const activity = ACTIVITY_LABELS[trail.activityType] || trail.activityType;
    const emoji = ACTIVITY_EMOJI[trail.activityType] || '🏔️';
    const diffColor = DIFFICULTY_COLORS[trail.difficulty] || '#90CAF9';
    const locations = trail.locations?.map((l) => l.name).join(' · ') || '';

    const image = h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f4c75 100%)',
        padding: '60px',
        fontFamily: 'sans-serif',
        color: 'white',
      },

      // Top bar: logo + difficulty badge
      h(
        'div',
        {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        },
        h(
          'div',
          { display: 'flex', alignItems: 'center', gap: '12px' },
          logo
            ? logoImg(logo, 40)
            : h('div', { display: 'flex', fontSize: '28px' }, BRAND_FALLBACK_EMOJI),
          h('div', {
            fontSize: '28px',
            fontWeight: 700,
            color: '#90CAF9',
            letterSpacing: '-0.5px',
          }, BRAND_LABEL[locale]),
        ),
        h('div', {
          display: 'flex',
          padding: '8px 20px',
          borderRadius: '24px',
          backgroundColor: diffColor,
          fontSize: '18px',
          fontWeight: 600,
        }, trail.difficulty),
      ),

      // Trail name
      h('div', {
        display: 'flex',
        fontSize: trail.name.length > 25 ? '52px' : '64px',
        fontWeight: 800,
        lineHeight: 1.1,
        marginBottom: '8px',
        letterSpacing: '-1px',
      }, trail.name),

      // Location
      ...(locations
        ? [
            h('div', {
              display: 'flex',
              fontSize: '24px',
              color: '#94a3b8',
              marginBottom: '32px',
            }, `📍 ${locations}`),
          ]
        : [
            h('div', { display: 'flex', marginBottom: '32px' }, ''),
          ]),

      // Stats row
      h(
        'div',
        {
          display: 'flex',
          gap: '40px',
          marginTop: 'auto',
          alignItems: 'center',
        },
        // Distance
        h(
          'div',
          { display: 'flex', flexDirection: 'column', gap: '4px' },
          h('div', { display: 'flex', fontSize: '16px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as unknown }, 'Distance'),
          h('div', { display: 'flex', fontSize: '36px', fontWeight: 700 }, `${distance} km`),
        ),
        // Elevation
        h(
          'div',
          { display: 'flex', flexDirection: 'column', gap: '4px' },
          h('div', { display: 'flex', fontSize: '16px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as unknown }, 'Elevation'),
          h('div', { display: 'flex', fontSize: '36px', fontWeight: 700 }, `↑ ${gain}m`),
        ),
        // Activity
        h(
          'div',
          { display: 'flex', flexDirection: 'column', gap: '4px' },
          h('div', { display: 'flex', fontSize: '16px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as unknown }, 'Activity'),
          h('div', { display: 'flex', fontSize: '36px', fontWeight: 700 }, `${emoji} ${activity}`),
        ),
      ),
    );

  return new ImageResponse(image as unknown as React.ReactElement, {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return defaultImage(locale, request);
  }
}

async function defaultImage(locale: Locale, request: Request) {
  const logo = await logoUrl(locale, request);

  const image = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f4c75 100%)',
      fontFamily: 'sans-serif',
      color: 'white',
    },
    h(
      'div',
      { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' },
      logo
        ? logoImg(logo, 96)
        : h('div', { display: 'flex', fontSize: '72px' }, BRAND_FALLBACK_EMOJI),
      h('div', { display: 'flex', fontSize: '72px', fontWeight: 800 }, BRAND_HEADING[locale]),
    ),
    h('div', { display: 'flex', fontSize: '28px', color: '#94a3b8' }, TAGLINE[locale]),
  );

  return new ImageResponse(image as unknown as React.ReactElement, {

    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}
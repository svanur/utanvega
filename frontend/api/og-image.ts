import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

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
  TrailRunning: '🏃',
  Running: '🏃‍♂️',
  Hiking: '🥾',
  Cycling: '🚴',
};

const ACTIVITY_LABELS: Record<string, string> = {
  TrailRunning: 'Trail Running',
  Running: 'Running',
  Hiking: 'Hiking',
  Cycling: 'Cycling',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4CAF50',
  Moderate: '#FF9800',
  Hard: '#f44336',
  Expert: '#9C27B0',
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
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return defaultImage();
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/trails/${encodeURIComponent(slug)}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!res.ok) {
      return defaultImage();
    }

    const trail: TrailResponse = await res.json();
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
          h('div', {
            fontSize: '28px',
            fontWeight: 700,
            color: '#90CAF9',
            letterSpacing: '-0.5px',
          }, '⛰️ UTANVEGA'),
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

    return new ImageResponse(image as React.ReactElement, {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return defaultImage();
  }
}

function defaultImage() {
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
    h('div', { display: 'flex', fontSize: '72px', fontWeight: 800, marginBottom: '16px' }, '⛰️ Utanvega'),
    h('div', { display: 'flex', fontSize: '28px', color: '#94a3b8' }, 'Trail Discovery in Iceland'),
  );

  return new ImageResponse(image as React.ReactElement, {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}

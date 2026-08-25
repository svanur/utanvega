export const config = { runtime: 'edge' };

import { siteOrigin, isIndexableHost } from './_site';

/**
 * Served at /robots.txt via a rewrite in vercel.json.
 *
 * An edge function rather than a static file because the correct response
 * differs per host: staging and preview deploys serve identical content to
 * production, so they must be excluded from the index rather than advertising
 * the same sitemap.
 */
export default function handler(request: Request) {
  const origin = siteOrigin(request);

  const body = isIndexableHost(request)
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        '# Comparison permutations collapse to /compare via rel=canonical;',
        '# keep crawlers off the parameter space entirely.',
        'Disallow: /compare?',
        '',
        '# /changelog-diary is deliberately NOT disallowed. It is served with',
        '# noindex by api/og.ts, and a crawler has to be allowed to fetch the',
        '# page to see that. Disallowing it would leave the URL eligible to',
        '# appear as a bare, snippet-less index entry if anything links to it.',
        '',
        `Sitemap: ${origin}/sitemap.xml`,
        '',
      ].join('\n')
    : ['# Non-production deployment — not for indexing.', 'User-agent: *', 'Disallow: /', ''].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}

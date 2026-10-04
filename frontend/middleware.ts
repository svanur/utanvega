// Vercel Routing Middleware (https://vercel.com/docs/routing-middleware —
// the platform's current name for what used to be called "Edge Middleware").
// Verified against current Vercel docs during #1212, not assumed from
// Next.js-flavored docs: Routing Middleware is framework-agnostic — this
// repo is a plain Vite SPA (frontend/package.json has no `next` dependency),
// and the file-convention (`middleware.ts` at the project root, a default
// export, a `config.matcher`) plus the `rewrite()`/`next()` helpers from
// `@vercel/functions` work identically here as they do in a Next.js app.
//
// Scope: vercel.json's own exact-root ("/") bot-UA rewrite rule never
// actually fired in production (confirmed via Vercel Observability → Logs
// showing zero /api/og invocations for root-path bot requests across
// multiple fresh deployments, while the working /:path* rule produced the
// expected log entries for the same bot UA on /events) — see #1212. That
// rule has been removed from vercel.json; this file is now the only thing
// that rewrites a bot-UA root request. It is scoped via `matcher` below to
// just the exact root path, so it never competes with vercel.json's
// /trails/:slug and /:path* rules (already confirmed working, untouched).
import { rewrite, next } from '@vercel/functions';
import { BOT_USER_AGENT_PATTERN } from './api/_site';

export const config = {
  matcher: '/',
  // Routing Middleware's current default runtime (nodejs) as of the Vercel
  // docs checked for #1212 — spelled out explicitly rather than relied on
  // implicitly, since this repo's other edge code (api/og.ts) still runs on
  // the older 'edge' runtime and a silent default change would be confusing
  // to a reader comparing the two.
  runtime: 'nodejs',
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // `matcher` above is what actually keeps Vercel from invoking this
  // function for any path other than "/" in production — this check is
  // defense-in-depth against a future matcher edit accidentally widening
  // scope, not the primary guard. Belt-and-braces, not belt-OR-braces.
  if (url.pathname !== '/' || !BOT_USER_AGENT_PATTERN.test(userAgent)) {
    // Not a bot-UA request to the exact root: fall through to the normal
    // SPA shell, byte-for-byte unchanged (vercel.json's catch-all
    // /(.*) -> index.html, or its /trails/:slug and /:path* rules, still
    // apply exactly as before).
    return next();
  }

  // Mirrors vercel.json's now-removed exact-root rule's destination exactly,
  // so og.ts sees the same `path` query shape it always has.
  return rewrite(new URL('/api/og?path=', request.url));
}

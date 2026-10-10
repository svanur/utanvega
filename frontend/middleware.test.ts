import { describe, it, expect } from 'vitest';
import middleware, { config } from './middleware';

const BOT_UA =
  'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function makeRequest(url: string, userAgent?: string): Request {
  return new Request(url, {
    headers: userAgent ? { 'user-agent': userAgent } : {},
  });
}

describe('middleware config', () => {
  it('scopes the matcher to the exact root path only', () => {
    // Anything broader would re-create #1212's original bug in reverse — a
    // matcher that also caught /trails/:slug or /:path* would run this
    // middleware ahead of (and compete with) vercel.json's already-working
    // rewrite rules for those routes, which are explicitly out of scope here.
    expect(config.matcher).toBe('/');
  });
});

describe('root-path bot-UA rewrite', () => {
  it('rewrites a bot-UA request for the exact root path to /api/og?path=', () => {
    const res = middleware(makeRequest('https://www.360runs.com/', BOT_UA));
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://www.360runs.com/api/og?path='
    );
  });

  it('passes a non-bot (plain browser) root request through unchanged', () => {
    const res = middleware(makeRequest('https://www.360runs.com/', BROWSER_UA));
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('passes through when no user-agent header is present at all', () => {
    const res = middleware(makeRequest('https://www.360runs.com/'));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('matches the other known crawler UAs too, not just one', () => {
    const uas = [
      'Twitterbot/1.0',
      'WhatsApp/2.23',
      'LinkedInBot/1.0',
      'Slackbot-LinkExpanding 1.0',
      'TelegramBot (like TwitterBot)',
      'Discordbot/2.0',
      'Googlebot/2.1',
      'bingbot/2.0',
      'Baiduspider/2.0',
      // Real-world YandexBot UAs capitalize the Y. Now that the pattern
      // carries the `i` flag, this must match without lowercasing it first.
      'YandexBot/3.0',
      'pinterest/0.2',
      'vkShare; +http://vk.com/dev/Share',
    ];
    for (const ua of uas) {
      const res = middleware(makeRequest('https://hlaupadagskra.is/', ua));
      expect(res.headers.get('x-middleware-rewrite'), ua).toBe(
        'https://hlaupadagskra.is/api/og?path='
      );
    }
  });
});

describe('non-root paths', () => {
  // middleware.ts's matcher ('/') means Vercel never invokes this function
  // for these paths at all in production. Calling it directly here (as the
  // matcher itself has no runtime behaviour to unit test) still proves the
  // handler logic doesn't accidentally rewrite something it was never
  // supposed to see, if the matcher config were ever loosened by mistake.
  it('leaves /events untouched for a bot UA', () => {
    const res = middleware(makeRequest('https://www.360runs.com/events', BOT_UA));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('leaves /trails/:slug untouched for a bot UA', () => {
    const res = middleware(
      makeRequest('https://www.360runs.com/trails/esjan-thverfellshorn', BOT_UA)
    );
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});

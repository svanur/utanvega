import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { BOT_USER_AGENT_PATTERN } from './api/_site';

// vercel.json (a static JSON file, see its own `rewrites`/`headers` entries)
// can't import BOT_USER_AGENT_PATTERN, so it hand-expands the same word list
// into a per-letter character class three times (case-insensitivity has to
// be spelled out there, since vercel.json has no regex `i`-flag equivalent).
// This test derives the canonical word list from the pattern itself, builds
// the expected character-class string the same way a human would, and
// checks all three vercel.json copies against it byte-for-byte — so a typo
// or a missed letter introduced while hand-expanding a future addition to
// the word list gets caught here instead of silently breaking bot detection
// for one of the three rules. See BOT_USER_AGENT_PATTERN's doc comment in
// frontend/api/_site.ts for the full list of five hand-kept copies.

const VERCEL_JSON_PATH = join(dirname(fileURLToPath(import.meta.url)), 'vercel.json');

/** Canonical bot-name word list, extracted from the `(a|b|c)` group inside BOT_USER_AGENT_PATTERN. */
function extractWordList(pattern: RegExp): string[] {
  const match = pattern.source.match(/\(([^)]+)\)/);
  if (!match) {
    throw new Error('BOT_USER_AGENT_PATTERN has no capture group to extract bot names from');
  }
  return match[1].split('|');
}

/** Expands a single word into vercel.json's hand-written per-letter character-class form, e.g. "go" -> "[gG][oO]". */
function toCharClass(word: string): string {
  return word
    .split('')
    .map((ch) => `[${ch.toLowerCase()}${ch.toUpperCase()}]`)
    .join('');
}

const BOT_NAMES = extractWordList(BOT_USER_AGENT_PATTERN);
const EXPECTED_PATTERN = `.*(${BOT_NAMES.map(toCharClass).join('|')}).*`;

/** The one headers rule in vercel.json that pairs the bot-UA `missing` check with `Cache-Control: no-store`. */
const CACHE_CONTROL_RULE_SOURCE = '/((?!api/|.*\\.[a-zA-Z0-9]+$).*)';

type HeadersRule = {
  source: string;
  missing?: { value: string }[];
  headers?: { key: string }[];
};

/**
 * Picks the cache-control headers rule by `source` (plus a `Cache-Control` entry in its
 * `headers` array), not by bare `missing` presence — a second rule that later gains its
 * own `missing` block must not be able to hijack this selection. See #1382.
 */
function findCacheControlHeaderRule(rules: HeadersRule[]): HeadersRule | undefined {
  return rules.find(
    (rule) => rule.source === CACHE_CONTROL_RULE_SOURCE && rule.headers?.some((header) => header.key === 'Cache-Control')
  );
}

function extractVercelJsonPatternValues(): { label: string; value: string }[] {
  const config = JSON.parse(readFileSync(VERCEL_JSON_PATH, 'utf-8'));
  const trailsRewrite = config.rewrites.find((r: { source: string }) => r.source === '/trails/:slug');
  const pathRewrite = config.rewrites.find((r: { source: string }) => r.source === '/:path*');
  const cacheControlHeader = findCacheControlHeaderRule(config.headers);
  if (!cacheControlHeader?.missing) {
    throw new Error(`No headers rule with source ${CACHE_CONTROL_RULE_SOURCE} and a Cache-Control header found in vercel.json`);
  }
  return [
    { label: '/trails/:slug rewrite has[0].value', value: trailsRewrite.has[0].value },
    { label: '/:path* rewrite has[0].value', value: pathRewrite.has[0].value },
    { label: 'cache-control headers rule missing[0].value', value: cacheControlHeader.missing[0].value },
  ];
}

describe('vercel.json bot-pattern character-class copies', () => {
  it('derives a non-empty word list from BOT_USER_AGENT_PATTERN', () => {
    expect(BOT_NAMES.length).toBeGreaterThan(0);
  });

  it.each(extractVercelJsonPatternValues().map(({ label, value }) => [label, value]))(
    '%s matches the generated character-class pattern exactly',
    (_label, value) => {
      expect(value).toBe(EXPECTED_PATTERN);
    }
  );

  it('does not let a second missing-bearing rule hijack the cache-control rule selection', () => {
    const decoyRule: HeadersRule = {
      source: '/some/other/path',
      missing: [{ value: 'decoy-pattern' }],
      headers: [{ key: 'X-Decoy-Header' }],
    };
    const realRule: HeadersRule = {
      source: CACHE_CONTROL_RULE_SOURCE,
      missing: [{ value: 'real-pattern' }],
      headers: [{ key: 'Cache-Control' }],
    };

    expect(findCacheControlHeaderRule([decoyRule, realRule])).toBe(realRule);
    expect(findCacheControlHeaderRule([realRule, decoyRule])).toBe(realRule);
  });
});

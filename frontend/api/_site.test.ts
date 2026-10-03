import { describe, it, expect } from 'vitest';
import { HOST_LOCALES, isIndexableHost, localeForHostname, siteOrigin } from './_site';

function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe('HOST_LOCALES', () => {
  it('maps every production host to a locale', () => {
    expect(HOST_LOCALES).toEqual({
      'hlaupadagskra.is': 'is',
      '360runs.com': 'en',
    });
  });
});

describe('isIndexableHost', () => {
  it.each([
    ['hlaupadagskra.is', true],
    ['www.hlaupadagskra.is', true],
    ['360runs.com', true],
    ['www.360runs.com', true],
    ['some-preview.vercel.app', false],
    ['localhost', false],
    // Lookalike hosts: contain a real suffix but are not a true (sub)domain
    // of it, so matchesHostSuffix's anchoring must reject them.
    ['evilhlaupadagskra.is', false],
    ['hlaupadagskra.is.evil.com', false],
    ['evil360runs.com', false],
    ['360runs.com.evil.net', false],
  ])('%s -> %s', (host, expected) => {
    expect(isIndexableHost(makeRequest(`https://${host}/robots.txt`))).toBe(expected);
  });

  it('prefers x-forwarded-host over the request URL host', () => {
    const request = makeRequest('https://internal.vercel.app/robots.txt', {
      'x-forwarded-host': '360runs.com',
    });
    expect(isIndexableHost(request)).toBe(true);
  });
});

describe('localeForHostname', () => {
  it.each([
    ['hlaupadagskra.is', 'is'],
    ['www.hlaupadagskra.is', 'is'],
    ['360runs.com', 'en'],
    ['www.360runs.com', 'en'],
    ['localhost', 'is'],
    ['some-preview.vercel.app', 'is'],
    // Lookalike hosts: superficially contain a real suffix (and, for the
    // 360runs.com ones, would resolve to 'en' if matching ever regressed to
    // .includes()), but must fall back to DEFAULT_LOCALE since they are not
    // true (sub)domains of any HOST_LOCALES entry.
    ['evilhlaupadagskra.is', 'is'],
    ['hlaupadagskra.is.evil.com', 'is'],
    ['evil360runs.com', 'is'],
    ['360runs.com.evil.net', 'is'],
  ])('%s -> %s', (hostname, expected) => {
    expect(localeForHostname(hostname)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(localeForHostname('WWW.360RUNS.COM')).toBe('en');
  });
});

describe('siteOrigin (regression guard)', () => {
  it('derives the origin from the 360runs.com host, unchanged by this issue', () => {
    expect(siteOrigin(makeRequest('https://360runs.com/sitemap.xml'))).toBe('https://360runs.com');
  });

  it('derives the origin from the hlaupadagskra.is host', () => {
    expect(siteOrigin(makeRequest('https://www.hlaupadagskra.is/sitemap.xml'))).toBe(
      'https://www.hlaupadagskra.is'
    );
  });
});

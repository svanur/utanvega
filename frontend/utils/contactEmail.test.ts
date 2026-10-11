import { describe, it, expect } from 'vitest';
import { emailForHostname } from './contactEmail';

describe('emailForHostname (#1067)', () => {
  it.each(['localhost', 'hlaupadagskra.is', 'www.hlaupadagskra.is'])(
    'resolves oskar@hlaupadagskra.is on %s',
    (hostname) => {
      expect(emailForHostname(hostname)).toBe('oskar@hlaupadagskra.is');
    }
  );

  it.each(['360runs.com', 'www.360runs.com'])(
    'resolves oskar@360runs.com on %s',
    (hostname) => {
      expect(emailForHostname(hostname)).toBe('oskar@360runs.com');
    }
  );

  // Lookalike hosts: superficially contain "360runs.com" but are not a true
  // (sub)domain of it, so matchesHostSuffix's anchoring must reject them and
  // fall back to the Icelandic address — same edge cases as
  // frontend/api/_site.test.ts.
  it.each(['evil360runs.com', '360runs.com.evil.net'])(
    'falls back to oskar@hlaupadagskra.is on lookalike host %s',
    (hostname) => {
      expect(emailForHostname(hostname)).toBe('oskar@hlaupadagskra.is');
    }
  );
});

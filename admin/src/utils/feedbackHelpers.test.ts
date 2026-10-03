import { describe, it, expect } from 'vitest';
import { getHostOrFallback, replySubject } from './feedbackHelpers';

// #1175: FeedbackPage's reply mailto subject derives its host from the submitting page's
// pageUrl (multi-brand: hlaupadagskra.is / 360runs.com), falling back to the hardcoded
// literal "hlaupadagskra.is" when pageUrl is empty or fails to parse. These assert the
// current `.host`-based behaviour (host:port divergence from the backend's `.hostname`-based
// SubmitFeedbackCommand.GetHostOrFallback is tracked separately in #1176).
describe('getHostOrFallback', () => {
  it('returns the host for a valid absolute URL', () => {
    expect(getHostOrFallback('https://360runs.com/trails/foo')).toBe('360runs.com');
  });

  it('returns the host for a valid absolute hlaupadagskra.is URL', () => {
    expect(getHostOrFallback('https://hlaupadagskra.is/trails/foo')).toBe('hlaupadagskra.is');
  });

  it('falls back to hlaupadagskra.is for an empty string', () => {
    expect(getHostOrFallback('')).toBe('hlaupadagskra.is');
  });

  it('falls back to hlaupadagskra.is for a malformed/non-URL string, without throwing', () => {
    expect(() => getHostOrFallback('not a url')).not.toThrow();
    expect(getHostOrFallback('not a url')).toBe('hlaupadagskra.is');
  });
});

describe('replySubject', () => {
  it('builds the encoded "Re: your feedback on <host>" subject for a known pageUrl', () => {
    expect(replySubject('https://360runs.com/trails/foo')).toBe(
      encodeURIComponent('Re: your feedback on 360runs.com'),
    );
  });
});

import { describe, it, expect } from 'vitest';
import { detectSocialTypeFromUrl } from './socialLinks';

// #838: the social link editor auto-fills Type from URL when Type is empty,
// falling back to the generic globe icon publicly if the detected type isn't
// one of the seven platforms the public icon switch recognizes.
describe('detectSocialTypeFromUrl', () => {
  it.each([
    ['https://www.facebook.com/someevent', 'facebook'],
    ['https://facebook.com/someevent', 'facebook'],
    ['https://www.instagram.com/someevent', 'instagram'],
    ['https://x.com/someevent', 'x'],
    ['https://twitter.com/someevent', 'twitter'],
    ['https://www.youtube.com/@someevent', 'youtube'],
    ['https://www.tiktok.com/@someevent', 'tiktok'],
    ['https://www.strava.com/clubs/someevent', 'strava'],
    ['https://vimeo.com/12345', 'vimeo'],
  ])('detects %s as %s', (url, expected) => {
    expect(detectSocialTypeFromUrl(url)).toBe(expected);
  });

  it('matches subdomains of a recognized platform', () => {
    expect(detectSocialTypeFromUrl('https://m.facebook.com/someevent')).toBe('facebook');
  });

  it('tolerates a missing protocol', () => {
    expect(detectSocialTypeFromUrl('instagram.com/someevent')).toBe('instagram');
  });

  it('returns null for an unrecognized platform', () => {
    expect(detectSocialTypeFromUrl('https://example.com/someevent')).toBeNull();
  });

  it('returns null for an unparsable URL', () => {
    expect(detectSocialTypeFromUrl('not a url')).toBeNull();
  });

  it('returns null for an empty or blank URL', () => {
    expect(detectSocialTypeFromUrl('')).toBeNull();
    expect(detectSocialTypeFromUrl('   ')).toBeNull();
  });
});

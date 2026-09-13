// Kept in sync with the platform set the public icon lookup recognizes
// (frontend/pages/OrganizerDetailPage.tsx:126-134). Each entry's `type` is the
// exact lowercase value that switch checks for.
const SOCIAL_URL_TYPES: { domain: string; type: string }[] = [
  { domain: 'facebook.com', type: 'facebook' },
  { domain: 'instagram.com', type: 'instagram' },
  { domain: 'x.com', type: 'x' },
  { domain: 'twitter.com', type: 'twitter' },
  { domain: 'youtube.com', type: 'youtube' },
  { domain: 'tiktok.com', type: 'tiktok' },
  { domain: 'strava.com', type: 'strava' },
  { domain: 'vimeo.com', type: 'vimeo' },
];

// Detects a social platform's type from a URL's hostname, for auto-filling a
// social link's Type field. Returns null when the URL is empty, unparsable,
// or doesn't match a recognized platform — callers must never guess.
export function detectSocialTypeFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let hostname: string;
  try {
    hostname = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  hostname = hostname.replace(/^www\./, '');
  const match = SOCIAL_URL_TYPES.find(({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`));
  return match?.type ?? null;
}

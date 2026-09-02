import type { PublicPhotoGallery } from '../hooks/useEvents';

type Localize = (is: string | null | undefined, en: string | null | undefined) => string | null;
type Translate = (key: string, opts?: Record<string, unknown>) => string;

// Prefers the gallery's own bilingual title; falls back to the pre-#491 "Photos from <domain>"
// label derived from the URL when there's no title, and to a bare "Photos" if the URL doesn't
// even parse (defensive — data comes from admin-entered URLs).
export function galleryLabel(gallery: PublicPhotoGallery, loc: Localize, t: Translate): string {
    const title = loc(gallery.title, gallery.titleEn);
    if (title) return title;
    try {
        const domain = new URL(gallery.url).hostname.replace(/^www\./, '');
        return t('races.photoGallery', { domain, defaultValue: 'Photos' });
    } catch {
        return t('races.photos', { defaultValue: 'Photos' });
    }
}

// Sorts defensively by sortOrder — the backend already orders PublicPhotoGalleryDto lists this
// way, but render sites shouldn't silently break if that ever changes upstream.
export function sortedGalleries(galleries: PublicPhotoGallery[]): PublicPhotoGallery[] {
    return [...galleries].sort((a, b) => a.sortOrder - b.sortOrder);
}

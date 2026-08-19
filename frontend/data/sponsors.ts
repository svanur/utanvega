// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all sponsor logos and promo slot content.
//
// SponsorStrip  → imports SPONSORS
// PromoStrip    → imports PROMO_SLOTS
// admin/src/data/sponsors.ts → synced copy for SponsorsPage (read-only)
//
// After editing this file, run:
//   .\scripts\sync-sponsors.ps1
// ─────────────────────────────────────────────────────────────────────────────

export interface Sponsor {
    flag: string;
    name: string;
    href: string;
    img: string;
    position: 'top' | 'bottom';
}

export interface PromoSlot {
    flag: string;
    name: string;
    img: string;
    href: string;
    alt: string;
    position: 'top' | 'bottom';
    /** If set, renders a text + CTA button overlay from these i18n keys: .title / .dates / .cta */
    textOverlay?: { i18nPrefix: string };
    notes: string;
}

/** True for hrefs that leave the site — these open in a new tab. */
export const isExternalHref = (href: string) => /^https?:\/\//i.test(href);

export const SPONSORS: Sponsor[] = [
    { flag: 'ad_top_sponsor_garmin',    name: 'Garmin', href: 'https://garminbudin.is/', img: '/sponsors/garmin.avif', position: 'top' },
    { flag: 'ad_top_sponsor_craft',     name: 'Craft',  href: 'https://craftverslun.is/', img: '/sponsors/craft.avif', position: 'top' },
    { flag: 'ad_bottom_sponsor_garmin', name: 'Garmin', href: 'https://garminbudin.is/', img: '/sponsors/garmin.avif', position: 'bottom' },
    { flag: 'ad_bottom_sponsor_craft',  name: 'Craft',  href: 'https://craftverslun.is/', img: '/sponsors/craft.avif', position: 'bottom' },
];

export const PROMO_SLOTS: PromoSlot[] = [
    {
        flag: 'ad_top_promo_1',
        name: 'Útivistaáskorun 2026',
        img: '/sponsors/challenge-2026.avif',
        href: 'https://passportage.com/p/utivistaaskorun',
        alt: 'Útivistaáskorun 2026',
        position: 'top',
        notes: 'Text baked into image — update image file to change copy. Links out to Passportage.',
    },
    {
        flag: 'ad_top_promo_2',
        name: 'Hlaupaferð í Svissnesku Alpana',
        img: '/sponsors/running-trip-2026.avif',
        href: '/shop/running-trip',
        alt: 'Hlaupaferð í Svissnesku Alpana',
        position: 'top',
        textOverlay: { i18nPrefix: 'promos.runningTrip' },
        notes: 'Text overlay rendered from i18n — update promos.runningTrip.* keys',
    },
    {
        flag: 'ad_bottom_promo_1',
        name: 'Útivistaáskorun 2026',
        img: '/sponsors/challenge-2026.avif',
        href: 'https://passportage.com/p/utivistaaskorun',
        alt: 'Útivistaáskorun 2026',
        position: 'bottom',
        notes: 'Text baked into image — update image file to change copy. Links out to Passportage.',
    },
    {
        flag: 'ad_bottom_promo_2',
        name: 'Promo slot (bottom right)',
        img: '/sponsors/running-trip-2026.avif',
        href: '/',
        alt: 'Promo slot bottom 2',
        position: 'bottom',
        notes: 'Bottom slot — replace img and href when in use',
    },
];

/** Combined metadata for the admin Sponsors page. */
export const SPONSOR_ADS = [
    ...SPONSORS.map(s => ({
        name: s.name,
        flag: s.flag,
        image: s.img,
        href: s.href,
        type: 'External' as const,
        placement: s.position === 'top' ? 'SponsorStrip (top)' : 'SponsorStrip (bottom)',
        notes: s.position === 'top' ? 'Small logo bar above content' : 'Small logo bar below content',
    })),
    ...PROMO_SLOTS.map(p => ({
        name: p.name,
        flag: p.flag,
        image: p.img,
        href: p.href,
        type: isExternalHref(p.href) ? ('External' as const) : ('Internal' as const),
        placement: p.position === 'top' ? 'PromoStrip (top)' : 'PromoStrip (bottom)',
        notes: p.notes,
    })),
];

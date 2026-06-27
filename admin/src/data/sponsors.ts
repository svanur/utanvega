// KEEP IN SYNC with frontend/data/sponsors.ts
// This is a read-only mirror for display in the admin UI.
// To add or change sponsors/promos, edit the frontend file and run:
//   .\scripts\sync-sponsors.ps1

export interface Sponsor {
    flag: string;
    name: string;
    href: string;
    img: string;
}

export interface PromoSlot {
    flag: string;
    name: string;
    img: string;
    href: string;
    alt: string;
    /** If set, renders a text + CTA button overlay from these i18n keys: .title / .dates / .cta */
    textOverlay?: { i18nPrefix: string };
    notes: string;
}

export const SPONSORS: Sponsor[] = [
    { flag: 'sponsor_garmin', name: 'Garmin', href: 'https://garminbudin.is/', img: '/sponsors/garmin.avif' },
    { flag: 'sponsor_craft',  name: 'Craft',  href: 'https://craftverslun.is/', img: '/sponsors/craft.avif' },
];

export const PROMO_SLOTS: PromoSlot[] = [
    {
        flag: 'promo_slot_1',
        name: 'Útivistaáskorun 2026',
        img: '/sponsors/challenge-2026.avif',
        href: '/challenge/2026',
        alt: 'Útivistaáskorun 2026',
        notes: 'Text baked into image — update image file to change copy',
    },
    {
        flag: 'promo_slot_2',
        name: 'Hlaupaferð í Svissnesku Alpana',
        img: '/sponsors/running-trip-2026.avif',
        href: '/shop/hlaupaferd',
        alt: 'Hlaupaferð í Svissnesku Alpana',
        textOverlay: { i18nPrefix: 'promos.runningTrip' },
        notes: 'Text overlay rendered from i18n — update promos.runningTrip.* keys',
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
        placement: 'SponsorStrip',
        notes: 'Small logo bar above content',
    })),
    ...PROMO_SLOTS.map(p => ({
        name: p.name,
        flag: p.flag,
        image: p.img,
        href: p.href,
        type: 'Internal' as const,
        placement: 'PromoStrip',
        notes: p.notes,
    })),
];

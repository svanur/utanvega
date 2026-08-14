export interface HeroBannerPhoto {
    src: string;
    alt: string;
    credit: string;
    creditUrl: string;
    objectPosition?: string;
}

export const heroBannerPhotos: HeroBannerPhoto[] = [
    {
        src: '/images/hero/hero-01.webp',
        alt: 'Runners on a trail in Iceland',
        credit: 'Sportmyndir.is',
        creditUrl: 'https://sportmyndir.is',
        objectPosition: 'center 30%',
    },
];

export function getRandomHeroBannerPhoto(): HeroBannerPhoto {
    return heroBannerPhotos[Math.floor(Math.random() * heroBannerPhotos.length)];
}

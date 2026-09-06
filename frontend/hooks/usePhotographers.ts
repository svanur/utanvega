import { useQuery } from '@tanstack/react-query';
import { API_URL } from './useTrails';
import type { SocialLink } from './useEvents';

export interface PhotographerGalleryEntry {
    eventId: string;
    eventName: string;
    eventNameEn: string | null;
    eventSlug: string;
    editionId: string;
    editionYear: number | null;
    editionDate: string | null;
    galleryUrl: string;
    galleryTitle: string | null;
    galleryTitleEn: string | null;
}

export interface PhotographerPublic {
    name: string;
    slug: string;
    website: string | null;
    description: string | null;
    descriptionEn: string | null;
    galleries: PhotographerGalleryEntry[];
    socialLinks: SocialLink[] | null;
}

export function usePhotographerBySlug(slug: string | undefined) {
    const { data: photographer = null, isPending, error: queryError } = useQuery<PhotographerPublic | null>({
        queryKey: ['photographer', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/photographers/${slug}`)
            .then(res => {
                if (res.status === 404) throw new Error('Photographer not found');
                if (!res.ok) throw new Error('Failed to fetch photographer');
                return res.json() as Promise<PhotographerPublic>;
            }),
        enabled: !!slug,
        staleTime: 30 * 60 * 1000,
    });
    return {
        photographer,
        loading: isPending && !!slug,
        error: queryError instanceof Error ? queryError.message : null,
    };
}

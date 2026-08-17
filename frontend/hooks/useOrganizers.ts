import { useQuery } from '@tanstack/react-query';
import { API_URL } from './useTrails';

export interface OrganizerEventSummary {
    id: string;
    name: string;
    nameEn: string | null;
    slug: string;
    description: string | null;
    descriptionEn: string | null;
    activityType: string;
    nextEditionDate: string | null;
    endDisplayDate: string | null;
}

export interface OrganizerPublic {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    description: string | null;
    descriptionEn: string | null;
    contactName: string | null;
    events: OrganizerEventSummary[];
}

export function useOrganizerBySlug(slug: string | undefined) {
    const { data: organizer = null, isPending, error: queryError } = useQuery<OrganizerPublic | null>({
        queryKey: ['organizer', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/organizers/${slug}`)
            .then(res => {
                if (res.status === 404) throw new Error('Organizer not found');
                if (!res.ok) throw new Error('Failed to fetch organizer');
                return res.json() as Promise<OrganizerPublic>;
            }),
        enabled: !!slug,
        staleTime: 30 * 60 * 1000,
    });
    return {
        organizer,
        loading: isPending && !!slug,
        error: queryError instanceof Error ? queryError.message : null,
    };
}

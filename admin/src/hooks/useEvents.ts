import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type ScheduleType = 'Yearly' | 'Seasonal' | 'Fixed' | 'Approximate';
export type EventType = 'Race' | 'Series' | 'Social' | 'Advertisement' | 'Festival' | 'Other';
export type ActivityType = 'TrailRunning' | 'Running' | 'Cycling' | 'Hiking' | 'FunRun' | 'ObstacleCourse' | 'CrossCountryRun' | 'Swim' | 'Canicross' | 'IronMan' | 'Other';
export type EventStatus = 'Unconfirmed' | 'Confirmed' | 'Cancelled' | 'Hidden' | 'Unlisted';
export type RegistrationStatus = 'NotStarted' | 'Open' | 'Closed';
export type RaceStatus = 'Active' | 'Completed' | 'Cancelled' | 'Hidden';
export type EditionStatus = 'Active' | 'Unconfirmed' | 'Cancelled' | 'Hidden';
export type TicketStatus = 'Available' | 'AlmostSoldOut' | 'SoldOut' | 'Closed' | 'NotStarted' | 'Free';
export type ResultType = 'Time' | 'Distance' | 'Laps';
export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

export interface SocialLink {
    type: string;
    url: string;
}

export interface ScheduleRule {
    type: ScheduleType;
    month?: number;
    weekOfMonth?: number;
    dayOfMonth?: number;
    dayOfWeek?: DayOfWeek;
    monthStart?: number;
    monthEnd?: number;
    date?: string;
}

export interface RaceDto {
    id: string;
    eventEditionId: string;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    name: string;
    nameEn: string | null;
    distanceLabel: string | null;
    distanceLabelEn: string | null;
    cutoffMinutes: number | null;
    description: string | null;
    descriptionEn: string | null;
    status: RaceStatus;
    sortOrder: number;
    ticketStatus: TicketStatus;
    resultType: ResultType;
    maxParticipants: number | null;
    itraPoints: number | null;
    certifiedBy: string | null;
    certifiedByEn: string | null;
    prizeMoney: number;
    championshipCategory: string | null;
    championshipCategoryEn: string | null;
    dateOfRace: string | null;
    startTime: string | null;
    trailDistanceMeters: number | null;
    trailElevationGain: number | null;
    activityType: ActivityType | null;
    translationHashes?: Record<string, string>;
}

export interface EventEditionDto {
    id: string;
    eventId: string;
    year: number | null;
    date: string | null;
    endDate: string | null;
    title: string | null;
    titleEn: string | null;
    registrationUrl: string | null;
    resultsUrl: string | null;
    photoGalleryUrl: string | null;
    notes: string | null;
    notesEn: string | null;
    registrationStatus: RegistrationStatus;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    races: RaceDto[];
    createdAt: string;
    updatedAt: string | null;
    translationHashes?: Record<string, string>;
    status: EditionStatus;
    effectiveCancelled: boolean;
}

export interface SeriesRaceDto {
    raceId: string;
    raceName: string;
    dateOfRace: string | null;
    startTime: string | null;
    distanceLabel: string | null;
    distanceLabelEn: string | null;
    ticketStatus: string;
    registrationUrl: string | null;
}

export interface EventSummaryDto {
    id: string;
    name: string;
    nameEn: string | null;
    slug: string;
    description: string | null;
    descriptionEn: string | null;
    type: EventType;
    activityType: ActivityType;
    status: EventStatus;
    organizerName: string | null;
    organizerNameEn: string | null;
    organizerWebsite: string | null;
    organizerId: string | null;
    alertMessage: string | null;
    alertMessageEn: string | null;
    alertSeverity: AlertSeverity | null;
    locationId: string | null;
    locationName: string | null;
    scheduleRule: ScheduleRule | null;
    socialLinks: SocialLink[] | null;
    nextEditionDate: string | null;
    daysUntil: number | null;
    editionCount: number;
    createdAt: string;
    updatedAt: string | null;
    seriesRaces: SeriesRaceDto[] | null;
    gpxPointLat: number | null;
    gpxPointLng: number | null;
    photoGalleryUrl: string | null;
    isMountainRace: boolean;
    terrainType: string | null;
    hasFutureEdition: boolean;
    endDisplayDate: string | null;
    translationHashes?: Record<string, string>;
    editionStatus: EditionStatus | null;
    editionEffectiveCancelled: boolean;
}

export interface EventDetailDto extends EventSummaryDto {
    upcomingDates: string[];
    editions: EventEditionDto[];
    translationHashes?: Record<string, string>;
}

export interface CreateEventInput {
    name: string;
    nameEn?: string;
    slug?: string;
    description?: string;
    descriptionEn?: string;
    type: EventType;
    activityType: ActivityType;
    status: EventStatus;
    organizerName?: string;
    organizerNameEn?: string;
    organizerWebsite?: string;
    organizerId?: string | null;
    alertMessage?: string;
    alertMessageEn?: string;
    alertSeverity?: AlertSeverity;
    locationId?: string | null;
    scheduleRule?: ScheduleRule | null;
    socialLinks?: SocialLink[] | null;
    gpxPointLat?: number | null;
    gpxPointLng?: number | null;
}

export interface UpdateEventInput {
    id: string;
    name: string;
    slug?: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    type: EventType;
    activityType: ActivityType;
    status: EventStatus;
    organizerName?: string;
    organizerNameEn?: string;
    organizerWebsite?: string;
    organizerId?: string | null;
    alertMessage?: string;
    alertMessageEn?: string;
    alertSeverity?: AlertSeverity;
    locationId?: string | null;
    scheduleRule?: ScheduleRule | null;
    socialLinks?: SocialLink[] | null;
    gpxPointLat?: number | null;
    gpxPointLng?: number | null;
    photoGalleryUrl?: string;
    translationHashes?: Record<string, string>;
}

export interface CreateEditionInput {
    eventId: string;
    year?: number | null;
    date?: string | null;
    endDate?: string | null;
    title?: string;
    titleEn?: string;
    registrationUrl?: string;
    resultsUrl?: string;
    photoGalleryUrl?: string;
    notes?: string;
    notesEn?: string;
    registrationStatus: RegistrationStatus;
    trailId?: string | null;
}

export interface UpdateEditionInput {
    id: string;
    year?: number | null;
    date?: string | null;
    endDate?: string | null;
    title?: string;
    titleEn?: string;
    registrationUrl?: string;
    resultsUrl?: string;
    photoGalleryUrl?: string;
    notes?: string;
    notesEn?: string;
    registrationStatus: RegistrationStatus;
    trailId?: string | null;
    translationHashes?: Record<string, string>;
    // Optional, patch-if-provided (unlike the other fields here, which are always resent as a full
    // snapshot): most UpdateEditionInput callers don't touch edition status and must not accidentally
    // reset it. Only pass this when you actually intend to change the status.
    status?: EditionStatus;
}

export interface CreateRaceInput {
    eventEditionId: string;
    trailId?: string | null;
    name: string;
    nameEn?: string;
    distanceLabel?: string;
    distanceLabelEn?: string;
    cutoffMinutes?: number | null;
    description?: string;
    descriptionEn?: string;
    status: RaceStatus;
    sortOrder: number;
    ticketStatus: TicketStatus;
    resultType: ResultType;
    maxParticipants?: number | null;
    itraPoints?: number | null;
    certifiedBy?: string;
    certifiedByEn?: string;
    prizeMoney: number;
    championshipCategory?: string;
    championshipCategoryEn?: string;
    dateOfRace?: string | null;
    startTime?: string | null;
}

export interface UpdateRaceInput {
    id: string;
    trailId?: string | null;
    name: string;
    nameEn?: string;
    distanceLabel?: string;
    distanceLabelEn?: string;
    cutoffMinutes?: number | null;
    description?: string;
    descriptionEn?: string;
    status: RaceStatus;
    sortOrder: number;
    ticketStatus: TicketStatus;
    resultType: ResultType;
    maxParticipants?: number | null;
    itraPoints?: number | null;
    certifiedBy?: string;
    certifiedByEn?: string;
    prizeMoney: number;
    championshipCategory?: string;
    championshipCategoryEn?: string;
    dateOfRace?: string | null;
    startTime?: string | null;
    activityType?: ActivityType | null;
    translationHashes?: Record<string, string>;
}

export interface GenerateEditionsForSeasonInput {
    eventId: string;
    from: string;
    to: string;
    trailId?: string | null;
    registrationUrl?: string | null;
    seasonStartMonth?: number | null;
    editionName?: string | null;
}

export interface GenerateEditionsForSeasonResult {
    editionIds: string[];
    count: number;
    racesCreated: number;
}

export const EVENTS_QUERY_KEY = ['admin', 'events'] as const;

export function useEvents() {
    const queryClient = useQueryClient();

    const { data: events = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: EVENTS_QUERY_KEY,
        queryFn: () => apiFetch<EventSummaryDto[]>('/api/v1/admin/events'),
        staleTime: 30_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY }),
        [queryClient]
    );

    const createEvent = async (input: CreateEventInput): Promise<{ id: string; slug: string }> => {
        const result = await apiFetch<{ id: string; slug?: string }>('/api/v1/admin/events', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await invalidate();
        const cached = queryClient.getQueryData<EventSummaryDto[]>(EVENTS_QUERY_KEY);
        const slug = result.slug ?? cached?.find(e => e.id === result.id)?.slug ?? result.id;
        return { id: result.id, slug };
    };

    const updateEvent = async (id: string, input: Omit<UpdateEventInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
        await invalidate();
    };

    const updateEventSilently = async (id: string, input: Omit<UpdateEventInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
    };

    const patchEventLocally = (id: string, patch: Partial<EventSummaryDto>) => {
        queryClient.setQueryData<EventSummaryDto[]>(EVENTS_QUERY_KEY, prev =>
            prev ? prev.map(e => e.id === id ? { ...e, ...patch } : e) : prev
        );
    };

    const deleteEvent = async (id: string) => {
        await apiFetch(`/api/v1/admin/events/${id}`, { method: 'DELETE' });
        queryClient.setQueryData<EventSummaryDto[]>(EVENTS_QUERY_KEY, prev =>
            prev ? prev.filter(e => e.id !== id) : prev
        );
    };

    const getEvent = async (slug: string) => apiFetch<EventDetailDto>(`/api/v1/admin/events/${slug}`);

    const createEdition = async (input: CreateEditionInput) => {
        const result = await apiFetch<{ id: string }>(`/api/v1/admin/events/${input.eventId}/editions`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await invalidate();
        return result.id;
    };

    const updateEdition = async (id: string, input: Omit<UpdateEditionInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/editions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
        await invalidate();
    };

    const updateEditionSilently = async (id: string, input: Omit<UpdateEditionInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/editions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
    };

    const deleteEdition = async (id: string) => {
        await apiFetch(`/api/v1/admin/editions/${id}`, { method: 'DELETE' });
        await invalidate();
    };

    const generateEditionsForSeason = async (input: GenerateEditionsForSeasonInput) => {
        const result = await apiFetch<GenerateEditionsForSeasonResult>(`/api/v1/admin/events/${input.eventId}/editions/generate`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await invalidate();
        return result;
    };

    const createRace = async (input: CreateRaceInput) => {
        const result = await apiFetch<{ id: string }>(`/api/v1/admin/editions/${input.eventEditionId}/races`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return result.id;
    };

    const updateRace = async (id: string, input: Omit<UpdateRaceInput, 'id'>) => {
        await apiFetch(`/api/v1/admin/races/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
    };

    const deleteRace = async (id: string) => {
        await apiFetch(`/api/v1/admin/races/${id}`, { method: 'DELETE' });
    };

    const reorderRaces = async (editionId: string, orderedIds: string[]) => {
        await apiFetch(`/api/v1/admin/editions/${editionId}/races/reorder`, {
            method: 'PUT',
            body: JSON.stringify({ orderedIds }),
        });
    };

    return {
        events,
        loading,
        error,
        refresh: invalidate,
        createEvent,
        updateEvent,
        updateEventSilently,
        patchEventLocally,
        deleteEvent,
        getEvent,
        createEdition,
        updateEdition,
        updateEditionSilently,
        deleteEdition,
        generateEditionsForSeason,
        createRace,
        updateRace,
        deleteRace,
        reorderRaces,
    };
}

export function useEventDetail(slug: string) {
    const queryKey = ['admin', 'event', slug] as const;

    const { data: detail = null, isLoading: loading, error: queryError, refetch } = useQuery({
        queryKey,
        queryFn: () => apiFetch<EventDetailDto>(`/api/v1/admin/events/${slug}`),
        enabled: !!slug,
        staleTime: 30_000,
    });

    const queryClient = useQueryClient();

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Failed to load event' : null;

    const setDetail = useCallback((updater: EventDetailDto | null | ((prev: EventDetailDto | null) => EventDetailDto | null)) => {
        queryClient.setQueryData<EventDetailDto | null>(queryKey, prev => {
            if (typeof updater === 'function') return updater(prev ?? null);
            return updater;
        });
    }, [queryClient, queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const refresh = useCallback(() => { void refetch(); }, [refetch]);

    return { detail, loading, error, refresh, setDetail };
}

export function useEventMutations() {
    const queryClient = useQueryClient();

    const invalidateEvents = () => queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });

    const createEvent = useMutation({
        mutationFn: (input: CreateEventInput) =>
            apiFetch<{ id: string; slug?: string }>('/api/v1/admin/events', {
                method: 'POST',
                body: JSON.stringify(input),
            }),
        onSuccess: () => invalidateEvents(),
    });

    const updateEvent = useMutation({
        mutationFn: ({ id, input }: { id: string; input: Omit<UpdateEventInput, 'id'> }) =>
            apiFetch(`/api/v1/admin/events/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ id, ...input }),
            }),
        onSuccess: () => invalidateEvents(),
    });

    return { createEvent, updateEvent };
}

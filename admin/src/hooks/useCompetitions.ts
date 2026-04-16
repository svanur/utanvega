import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface ScheduleRule {
    type: 'Yearly' | 'Seasonal' | 'Fixed';
    month?: number;
    weekOfMonth?: number;
    dayOfWeek?: string;
    monthStart?: number;
    monthEnd?: number;
    date?: string;
}

export interface CompetitionDto {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    organizerName: string | null;
    organizerWebsite: string | null;
    registrationUrl: string | null;
    alertMessage: string | null;
    alertSeverity: string | null;
    locationId: string | null;
    locationName: string | null;
    status: string;
    scheduleRule: ScheduleRule | null;
    nextDate: string | null;
    daysUntil: number | null;
    raceCount: number;
    createdAt: string;
    updatedAt: string | null;
}

export interface RaceDto {
    id: string;
    competitionId: string;
    trailId: string | null;
    trailName: string | null;
    trailSlug: string | null;
    name: string;
    distanceLabel: string | null;
    cutoffMinutes: number | null;
    description: string | null;
    status: string;
    sortOrder: number;
    trailLength: number | null;
    trailElevationGain: number | null;
}

export interface CompetitionDetailDto extends CompetitionDto {
    races: RaceDto[];
}

export interface CreateCompetitionInput {
    name: string;
    slug?: string;
    description?: string;
    organizerName?: string;
    organizerWebsite?: string;
    registrationUrl?: string;
    alertMessage?: string;
    alertSeverity?: string;
    locationId?: string | null;
    status: string;
    scheduleRule?: ScheduleRule | null;
}

export interface CreateRaceInput {
    competitionId: string;
    trailId?: string | null;
    name: string;
    distanceLabel?: string;
    cutoffMinutes?: number | null;
    description?: string;
    status: string;
    sortOrder: number;
}

export function useCompetitions() {
    const [competitions, setCompetitions] = useState<CompetitionDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCompetitions = async () => {
        try {
            setLoading(true);
            const data = await apiFetch<CompetitionDto[]>('/api/v1/admin/competitions');
            setCompetitions(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompetitions();
    }, []);

    const createCompetition = async (input: CreateCompetitionInput) => {
        const result = await apiFetch<{ id: string }>('/api/v1/admin/competitions', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await fetchCompetitions();
        return result.id;
    };

    const updateCompetition = async (id: string, input: CreateCompetitionInput) => {
        await apiFetch(`/api/v1/admin/competitions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...input }),
        });
        await fetchCompetitions();
    };

    const deleteCompetition = async (id: string) => {
        await apiFetch(`/api/v1/admin/competitions/${id}`, { method: 'DELETE' });
        setCompetitions(prev => prev.filter(c => c.id !== id));
    };

    const getCompetition = async (slug: string) => {
        return apiFetch<CompetitionDetailDto>(`/api/v1/competitions/${slug}`);
    };

    const createRace = async (input: CreateRaceInput) => {
        const result = await apiFetch<{ id: string }>(`/api/v1/admin/competitions/${input.competitionId}/races`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return result.id;
    };

    const updateRace = async (id: string, input: Omit<CreateRaceInput, 'competitionId'> & { id: string }) => {
        await apiFetch(`/api/v1/admin/races/${id}`, {
            method: 'PUT',
            body: JSON.stringify(input),
        });
    };

    const deleteRace = async (id: string) => {
        await apiFetch(`/api/v1/admin/races/${id}`, { method: 'DELETE' });
    };

    return {
        competitions,
        loading,
        error,
        refresh: fetchCompetitions,
        createCompetition,
        updateCompetition,
        deleteCompetition,
        getCompetition,
        createRace,
        updateRace,
        deleteRace,
    };
}

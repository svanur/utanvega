import { useState, useEffect } from 'react';
import { API_URL } from './useTrails';

export interface ScheduleRule {
    type: 'Yearly' | 'Seasonal' | 'Fixed';
    month?: number;
    weekOfMonth?: number;
    dayOfWeek?: string;
    monthStart?: number;
    monthEnd?: number;
    date?: string;
}

export interface CompetitionSummary {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    organizerName: string | null;
    organizerWebsite: string | null;
    registrationUrl: string | null;
    locationId: string | null;
    locationName: string | null;
    status: string;
    scheduleRule: ScheduleRule | null;
    nextDate: string | null;
    daysUntil: number | null;
    raceCount: number;
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
    trailDistanceMeters: number | null;
    trailElevationGain: number | null;
}

export interface CompetitionDetail extends CompetitionSummary {
    upcomingDates: string[];
    races: RaceDto[];
}

export function useCompetitions() {
    const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_URL}/api/v1/competitions`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch competitions');
                return res.json();
            })
            .then(data => {
                setCompetitions(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return { competitions, loading, error };
}

export function useCompetitionBySlug(slug: string | undefined) {
    const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) {
            setLoading(false);
            return;
        }

        setLoading(true);
        fetch(`${API_URL}/api/v1/competitions/${encodeURIComponent(slug)}`)
            .then(res => {
                if (!res.ok) throw new Error('Competition not found');
                return res.json();
            })
            .then(data => {
                setCompetition(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [slug]);

    return { competition, loading, error };
}

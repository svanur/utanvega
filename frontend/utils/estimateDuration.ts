/**
 * Estimate trail completion time based on distance, elevation gain, and activity type.
 * Uses modified Naismith's Rule with activity-specific pace parameters.
 */

interface PaceParams {
    baseSpeedKmh: number;
    climbPenaltyMinPer100m: number;
}

const PACE_MAP: Record<string, PaceParams> = {
    running:      { baseSpeedKmh: 9,  climbPenaltyMinPer100m: 2 },
    trailrunning: { baseSpeedKmh: 7,  climbPenaltyMinPer100m: 3 },
    hiking:       { baseSpeedKmh: 4,  climbPenaltyMinPer100m: 10 },
    cycling:      { baseSpeedKmh: 20, climbPenaltyMinPer100m: 3 },
};

const DEFAULT_PACE: PaceParams = { baseSpeedKmh: 5, climbPenaltyMinPer100m: 5 };

export function estimateDurationMinutes(lengthMeters: number, elevationGainMeters: number, activityType: string): number {
    const km = lengthMeters / 1000;
    const { baseSpeedKmh, climbPenaltyMinPer100m } = PACE_MAP[activityType.toLowerCase()] ?? DEFAULT_PACE;
    return Math.round((km / baseSpeedKmh) * 60 + (elevationGainMeters / 100) * climbPenaltyMinPer100m);
}

export function formatDuration(totalMinutes: number): string {
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function estimateDuration(lengthMeters: number, elevationGainMeters: number, activityType: string): string {
    return formatDuration(estimateDurationMinutes(lengthMeters, elevationGainMeters, activityType));
}

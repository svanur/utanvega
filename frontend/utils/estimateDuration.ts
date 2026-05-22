/**
 * Estimate trail completion time based on distance, elevation gain, and activity type.
 * Uses modified Naismith's Rule with activity-specific pace parameters.
 */

interface PaceParams {
    baseSpeedKmh: number;
    climbPenaltyMinPer100m: number;
}

const PACE_MAP: Record<string, PaceParams> = {
    running:        { baseSpeedKmh: 11, climbPenaltyMinPer100m: 1.5 },
    trailrunning:   { baseSpeedKmh: 10, climbPenaltyMinPer100m: 2.5 },
    hiking:         { baseSpeedKmh: 4,  climbPenaltyMinPer100m: 10 },
    cycling:        { baseSpeedKmh: 20, climbPenaltyMinPer100m: 3 },
    funrun:           { baseSpeedKmh: 9,  climbPenaltyMinPer100m: 1.5 },
    obstaclecourse:   { baseSpeedKmh: 5,  climbPenaltyMinPer100m: 4 },
    crosscountryrun:  { baseSpeedKmh: 9.5, climbPenaltyMinPer100m: 2 },
};

const DEFAULT_PACE: PaceParams = { baseSpeedKmh: 5, climbPenaltyMinPer100m: 5 };

const NO_ESTIMATE_TYPES = new Set(['social', 'other']);

/** Returns true if the activity type supports time estimation. */
export function supportsTimeEstimate(activityType: string): boolean {
    return !NO_ESTIMATE_TYPES.has(activityType.toLowerCase());
}

export function estimateDurationMinutes(lengthMeters: number, elevationGainMeters: number, activityType: string): number | null {
    if (!supportsTimeEstimate(activityType)) return null;
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

export function estimateDuration(lengthMeters: number, elevationGainMeters: number, activityType: string): string | null {
    const minutes = estimateDurationMinutes(lengthMeters, elevationGainMeters, activityType);
    return minutes !== null ? formatDuration(minutes) : null;
}

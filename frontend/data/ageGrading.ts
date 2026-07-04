// WMA 2015 Road Age Grading Tables
// Source: Howard Grubb, mldrroad15 — https://howardgrubb.co.uk/athletics/mldrroad15.html
// Open standards = world-best road times at peak age (seconds)
// Age factors = performance multiplier per age (1.0 = peak, <1.0 = decline)
// Ages outside 20–80 are clamped to nearest boundary.

export type Gender = 'male' | 'female';

export interface DistanceStandard {
    label: string;
    km: number;
    openStandard: { male: number; female: number };
}

export const AG_DISTANCES: DistanceStandard[] = [
    { label: '5K',             km: 5,        openStandard: { male: 757,   female: 851   } },
    { label: '10K',            km: 10,       openStandard: { male: 1577,  female: 1771  } },
    { label: 'Half Marathon',  km: 21.0975,  openStandard: { male: 3503,  female: 3922  } },
    { label: 'Marathon',       km: 42.195,   openStandard: { male: 7416,  female: 8125  } },
    { label: '50K',            km: 50,       openStandard: { male: 9838,  female: 11792 } },
    { label: '100K',           km: 100,      openStandard: { male: 22613, female: 25580 } },
];

// Age factors at 5-year anchor points; linear interpolation is used between them.
// Male road factors (WMA 2015)
const MALE_ANCHORS: [number, number][] = [
    [20, 0.9639],
    [25, 0.9868],
    [30, 1.0000],
    [35, 0.9889],
    [40, 0.9561],
    [45, 0.9108],
    [50, 0.8637],
    [55, 0.8129],
    [60, 0.7584],
    [65, 0.7029],
    [70, 0.6409],
    [75, 0.5800],
    [80, 0.5218],
];

// Female road factors (WMA 2015)
const FEMALE_ANCHORS: [number, number][] = [
    [20, 0.9614],
    [25, 0.9843],
    [30, 1.0000],
    [35, 0.9860],
    [40, 0.9510],
    [45, 0.9030],
    [50, 0.8530],
    [55, 0.7975],
    [60, 0.7406],
    [65, 0.6831],
    [70, 0.6208],
    [75, 0.5584],
    [80, 0.4989],
];

function interpolateFactor(anchors: [number, number][], age: number): number {
    const clamped = Math.max(anchors[0][0], Math.min(anchors[anchors.length - 1][0], age));
    for (let i = 0; i < anchors.length - 1; i++) {
        const [a0, f0] = anchors[i];
        const [a1, f1] = anchors[i + 1];
        if (clamped >= a0 && clamped <= a1) {
            const t = (clamped - a0) / (a1 - a0);
            return f0 + t * (f1 - f0);
        }
    }
    return anchors[anchors.length - 1][1];
}

export function getAgeFactor(gender: Gender, age: number): number {
    return interpolateFactor(gender === 'male' ? MALE_ANCHORS : FEMALE_ANCHORS, age);
}

export interface AgeGradeResult {
    percentage: number;
    ageGradedSeconds: number;
    tier: string;
    tierColor: string;
    nextTier: { name: string; threshold: number; improveBySeconds: number } | null;
}

export function calculateAgeGrade(
    gender: Gender,
    age: number,
    distanceKm: number,
    runnerSeconds: number,
): AgeGradeResult | null {
    if (runnerSeconds <= 0 || age < 5 || age > 100) return null;

    // Find open standard — interpolate if between two known distances
    const sorted = [...AG_DISTANCES].sort((a, b) => a.km - b.km);
    let openStandard: number;

    const exact = sorted.find(d => Math.abs(d.km - distanceKm) < 0.01);
    if (exact) {
        openStandard = exact.openStandard[gender];
    } else {
        const lower = [...sorted].reverse().find(d => d.km < distanceKm);
        const upper = sorted.find(d => d.km > distanceKm);
        if (!lower || !upper) return null;
        const t = (distanceKm - lower.km) / (upper.km - lower.km);
        openStandard = lower.openStandard[gender] + t * (upper.openStandard[gender] - lower.openStandard[gender]);
    }

    const ageFactor = getAgeFactor(gender, age);
    const percentage = (openStandard / (runnerSeconds * ageFactor)) * 100;
    const ageGradedSeconds = runnerSeconds * ageFactor;

    const { tier, tierColor } = getTier(percentage);

    const TIER_THRESHOLDS = [
        { threshold: 60, name: 'Local Class' },
        { threshold: 70, name: 'Regional Class' },
        { threshold: 80, name: 'National Class' },
        { threshold: 90, name: 'World Class' },
    ];
    const nextTierDef = TIER_THRESHOLDS.find(t => t.threshold > percentage);
    const nextTier = nextTierDef
        ? (() => {
            const targetSeconds = openStandard / ((nextTierDef.threshold / 100) * ageFactor);
            return { ...nextTierDef, improveBySeconds: runnerSeconds - targetSeconds };
          })()
        : null;

    return { percentage, ageGradedSeconds, tier, tierColor, nextTier };
}

export function getTier(pct: number): { tier: string; tierColor: string } {
    if (pct >= 90) return { tier: 'World Class',   tierColor: '#f59e0b' };
    if (pct >= 80) return { tier: 'National Class', tierColor: '#6366f1' };
    if (pct >= 70) return { tier: 'Regional Class', tierColor: '#22c55e' };
    if (pct >= 60) return { tier: 'Local Class',    tierColor: '#3b82f6' };
    return           { tier: 'Recreational',        tierColor: '#94a3b8' };
}

export function formatSeconds(totalSeconds: number): string {
    const s = Math.round(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

export function parseTimeToSeconds(val: string): number | null {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return null;
}

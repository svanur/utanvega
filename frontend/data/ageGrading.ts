// 2025 USATF MLDR Road Age Grading Tables
// Source: USATF Masters Long Distance Running (MLDR) council, approved 2025-01-10.
// Compiled by Alan Jones — https://github.com/AlanLyttonJones/Age-Grade-Tables
// Age factors and open standards are generated from the committed source workbooks
// (frontend/data/source/{male,female}Road2025.xlsx) via
// frontend/data/source/convert_age_grading.py — see ageGradingFactors.generated.ts
// and frontend/data/source/README.md for provenance.
// Open standards = world-best road times at peak age (seconds)
// Age factors = performance multiplier per age (1.0 = peak, <1.0 = decline)
// Factors are looked up per year of age directly (no interpolation, no clamping);
// ages outside the published 5–100 range are rejected by calculateAgeGrade below.

import { MALE_FACTORS, FEMALE_FACTORS, MIN_AGE, MAX_AGE, OPEN_STANDARDS } from './ageGradingFactors.generated';

export type Gender = 'male' | 'female';

export interface DistanceStandard {
    // Stable, language-independent identifier — used as the <Select> value, distanceKey
    // state, and ?dist= URL param. Never translate or rename existing values, or shared
    // links break.
    key: string;
    // Suffix into i18n's tools.ageGrading.distanceNames.<i18nKey> for the display name.
    i18nKey: string;
    km: number;
    openStandard: { male: number; female: number };
}

export const AG_DISTANCES: DistanceStandard[] = [
    { key: '5K',             i18nKey: '5k',       km: 5,        openStandard: { male: OPEN_STANDARDS.male['5K'],            female: OPEN_STANDARDS.female['5K']            } },
    { key: '10K',            i18nKey: '10k',      km: 10,       openStandard: { male: OPEN_STANDARDS.male['10K'],           female: OPEN_STANDARDS.female['10K']           } },
    { key: 'Half Marathon',  i18nKey: 'half',     km: 21.0975,  openStandard: { male: OPEN_STANDARDS.male['Half Marathon'], female: OPEN_STANDARDS.female['Half Marathon'] } },
    { key: 'Marathon',       i18nKey: 'marathon', km: 42.195,   openStandard: { male: OPEN_STANDARDS.male['Marathon'],      female: OPEN_STANDARDS.female['Marathon']      } },
    { key: '50K',            i18nKey: '50k',      km: 50,       openStandard: { male: OPEN_STANDARDS.male['50K'],           female: OPEN_STANDARDS.female['50K']           } },
    { key: '100K',           i18nKey: '100k',     km: 100,      openStandard: { male: OPEN_STANDARDS.male['100K'],          female: OPEN_STANDARDS.female['100K']          } },
];

// Direct per-year, per-distance lookup — no interpolation between anchor ages and no
// clamping to a 20–80 range. `distanceKey` must be one of AG_DISTANCES' keys; ages
// outside the published MIN_AGE–MAX_AGE range are the caller's responsibility to guard
// against (calculateAgeGrade below does this for its own callers).
export function getAgeFactor(gender: Gender, age: number, distanceKey: string): number {
    const table = gender === 'male' ? MALE_FACTORS : FEMALE_FACTORS;
    const row = table[distanceKey];
    if (!row || age < MIN_AGE || age > MAX_AGE) return NaN;
    return row[Math.round(age) - MIN_AGE];
}

// How many years on each side of the entered age get a per-year row in the
// default (non-expanded) "equivalent times by age" table — a single named
// constant so the band width isn't a magic number scattered through the JSX.
export const AGE_BAND_HALF_WIDTH = 5;

// Fixed 5-year-step anchor ages shown outside the per-year band around the
// entered age — the same list the table used before per-year banding existed.
export const AGE_TABLE_ANCHOR_ROWS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];

// Builds the sorted, deduplicated list of ages to render in the "equivalent
// times by age" table. `expanded` shows every year from MIN_AGE to MAX_AGE;
// otherwise a per-year band of AGE_BAND_HALF_WIDTH years around `enteredAge`
// is shown, plus the fixed 5-year-step anchors that fall outside that band.
// Always clamped to [MIN_AGE, MAX_AGE] — no out-of-range ages are produced,
// and `enteredAge` itself always lands in the band, so it's never duplicated
// against an adjacent anchor row.
export function getAgeTableRows(enteredAge: number, expanded: boolean): number[] {
    if (expanded) {
        const rows: number[] = [];
        for (let a = MIN_AGE; a <= MAX_AGE; a++) rows.push(a);
        return rows;
    }

    const clampedAge = Math.min(MAX_AGE, Math.max(MIN_AGE, enteredAge));
    const bandMin = Math.max(MIN_AGE, clampedAge - AGE_BAND_HALF_WIDTH);
    const bandMax = Math.min(MAX_AGE, clampedAge + AGE_BAND_HALF_WIDTH);

    const rows = new Set<number>();
    for (let a = bandMin; a <= bandMax; a++) rows.add(a);
    for (const a of AGE_TABLE_ANCHOR_ROWS) {
        if (a >= MIN_AGE && a <= MAX_AGE && (a < bandMin || a > bandMax)) rows.add(a);
    }
    return Array.from(rows).sort((a, b) => a - b);
}

export interface AgeGradeResult {
    percentage: number;
    ageGradedSeconds: number;
    tier: string;
    tierColor: string;
    nextTier: { key: string; threshold: number; improveBySeconds: number } | null;
}

export function calculateAgeGrade(
    gender: Gender,
    age: number,
    distanceKm: number,
    runnerSeconds: number,
): AgeGradeResult | null {
    if (runnerSeconds <= 0 || age < 5 || age > 100) return null;

    // Find open standard and age factor — interpolate both if between two known distances
    const sorted = [...AG_DISTANCES].sort((a, b) => a.km - b.km);
    let openStandard: number;
    let ageFactor: number;

    const exact = sorted.find(d => Math.abs(d.km - distanceKm) < 0.01);
    if (exact) {
        openStandard = exact.openStandard[gender];
        ageFactor = getAgeFactor(gender, age, exact.key);
    } else {
        const lower = [...sorted].reverse().find(d => d.km < distanceKm);
        const upper = sorted.find(d => d.km > distanceKm);
        if (!lower || !upper) return null;
        const t = (distanceKm - lower.km) / (upper.km - lower.km);
        openStandard = lower.openStandard[gender] + t * (upper.openStandard[gender] - lower.openStandard[gender]);
        const lowerFactor = getAgeFactor(gender, age, lower.key);
        const upperFactor = getAgeFactor(gender, age, upper.key);
        ageFactor = lowerFactor + t * (upperFactor - lowerFactor);
    }

    const rawPercentage = (openStandard / (runnerSeconds * ageFactor)) * 100;
    const percentage = Math.round(rawPercentage * 10) / 10;
    const ageGradedSeconds = runnerSeconds * ageFactor;

    const { tier, tierColor } = getTier(percentage);

    const TIER_THRESHOLDS = [
        { threshold: 60, key: 'localClass' },
        { threshold: 70, key: 'regionalClass' },
        { threshold: 80, key: 'nationalClass' },
        { threshold: 90, key: 'worldClass' },
    ];
    let nextTier: AgeGradeResult['nextTier'] = null;
    for (const t of TIER_THRESHOLDS) {
        if (t.threshold <= percentage) continue;
        const targetSeconds = openStandard / ((t.threshold / 100) * ageFactor);
        const improveBySeconds = runnerSeconds - targetSeconds;
        if (improveBySeconds >= 1) { nextTier = { key: t.key, threshold: t.threshold, improveBySeconds }; break; }
    }

    return { percentage, ageGradedSeconds, tier, tierColor, nextTier };
}

export function getTier(pct: number): { tier: string; tierColor: string } {
    if (pct >= 90) return { tier: 'worldClass',    tierColor: '#f59e0b' };
    if (pct >= 80) return { tier: 'nationalClass', tierColor: '#6366f1' };
    if (pct >= 70) return { tier: 'regionalClass', tierColor: '#22c55e' };
    if (pct >= 60) return { tier: 'localClass',    tierColor: '#3b82f6' };
    return           { tier: 'recreational',       tierColor: '#94a3b8' };
}

// A percentage over 100 means the entered time beats the age-group record for
// this age/sex/distance — either a genuine (very rare) record-beating run, or
// far more commonly a mistyped time, e.g. a two-part "H:MM" time such as 3:30
// for a marathon read as mm:ss (3m30s) instead of the intended h:mm:ss. This
// is a display-layer flag only — calculateAgeGrade's math is unchanged and
// still returns the raw percentage; callers decide how to warn about it.
export function isImplausibleResult(percentage: number): boolean {
    return percentage > 100;
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

import { describe, it, expect } from 'vitest';
import {
    AG_DISTANCES, calculateAgeGrade, getAgeFactor, parseTimeToSeconds,
    getAgeTableRows, AGE_BAND_HALF_WIDTH, AGE_TABLE_ANCHOR_ROWS,
} from './ageGrading';
import { MIN_AGE, MAX_AGE } from './ageGradingFactors.generated';

// Spot-checks pinned against the 2025 USATF MLDR road workbooks
// (frontend/data/source/{male,female}Road2025.xlsx, `Age Factors` sheet).
// Re-derive with frontend/data/source/convert_age_grading.py if these ever
// need to change for a new edition.

describe('AG_DISTANCES', () => {
    it('keeps the existing six distances, including both ultras', () => {
        expect(AG_DISTANCES.map(d => d.key)).toEqual([
            '5K', '10K', 'Half Marathon', 'Marathon', '50K', '100K',
        ]);
    });

    it('uses 2025 OC-sec open standards', () => {
        const byKey = Object.fromEntries(AG_DISTANCES.map(d => [d.key, d.openStandard]));
        expect(byKey['Half Marathon'].female).toBe(3772);
        expect(byKey['5K'].male).toBe(769);
        expect(byKey['10K'].male).toBe(1584);
        expect(byKey['Marathon'].male).toBe(7235);
        expect(byKey['50K'].male).toBe(8820);
        expect(byKey['100K'].male).toBe(21360);
        expect(byKey['5K'].female).toBe(834);
        expect(byKey['10K'].female).toBe(1726);
        expect(byKey['Marathon'].female).toBe(7796);
        expect(byKey['50K'].female).toBe(9390);
        expect(byKey['100K'].female).toBe(23591);
    });
});

describe('getAgeFactor — direct per-year, per-distance lookup', () => {
    it('pins named factors across three distances including an ultra, for both sexes', () => {
        // 5K
        expect(getAgeFactor('male', 14, '5K')).toBeCloseTo(0.9423, 4);
        expect(getAgeFactor('female', 14, '5K')).toBeCloseTo(0.9243, 4);
        // Marathon
        expect(getAgeFactor('male', 87, 'Marathon')).toBeCloseTo(0.5033, 4);
        // 100K (ultra)
        expect(getAgeFactor('male', 60, '100K')).toBeCloseTo(0.8143, 4);
        expect(getAgeFactor('female', 60, '100K')).toBeCloseTo(0.7965, 4);
    });

    it('looks up a junior age (14) at its own factor, not age 20\'s', () => {
        const junior = getAgeFactor('male', 14, '5K');
        const twenty = getAgeFactor('male', 20, '5K');
        expect(junior).toBeCloseTo(0.9423, 4);
        expect(twenty).toBeCloseTo(1, 4);
        expect(junior).not.toBeCloseTo(twenty, 2);
    });

    it('looks up an over-80 age (87) at its own factor, not age 80\'s', () => {
        const over80 = getAgeFactor('male', 87, 'Marathon');
        const eighty = getAgeFactor('male', 80, 'Marathon');
        expect(over80).toBeCloseTo(0.5033, 4);
        expect(eighty).toBeCloseTo(0.6219, 4);
        expect(over80).not.toBeCloseTo(eighty, 2);
    });

    it('does not clamp ages outside 5-100 — returns NaN instead of substituting a boundary', () => {
        expect(getAgeFactor('male', 4, '5K')).toBeNaN();
        expect(getAgeFactor('male', 101, '5K')).toBeNaN();
    });

    it('shares an identical age curve across Marathon/50K/100K per the source data', () => {
        // Real property of the 2025 tables, not a bug in the conversion: past marathon
        // distance the workbooks publish the same Masters-decline curve for Marathon,
        // 50K and 100K (only the open-standard pace differs). Verified directly against
        // the raw source sheet — see PR description.
        for (const age of [30, 52, 75]) {
            const marathon = getAgeFactor('female', age, 'Marathon');
            expect(getAgeFactor('female', age, '50K')).toBe(marathon);
            expect(getAgeFactor('female', age, '100K')).toBe(marathon);
        }
    });
});

describe('calculateAgeGrade — reported case', () => {
    it('computes the age grade for W52, Half Marathon, 1:25:26 against the 2025 tables', () => {
        const seconds = parseTimeToSeconds('1:25:26')!;
        const distance = AG_DISTANCES.find(d => d.key === 'Half Marathon')!;
        const result = calculateAgeGrade('female', 52, distance.km, seconds);
        expect(result).not.toBeNull();
        // Computed from the source workbook directly: OC sec 3772 / (5126 * 0.8546) * 100
        expect(result!.percentage).toBeCloseTo(86.1, 1);
        expect(result!.tier).toBe('nationalClass');
    });
});

describe('getAgeTableRows — default (banded) view', () => {
    it('includes a per-year row for every age within the band around a mid-range age', () => {
        const rows = getAgeTableRows(52, false);
        for (let a = 52 - AGE_BAND_HALF_WIDTH; a <= 52 + AGE_BAND_HALF_WIDTH; a++) {
            expect(rows).toContain(a);
        }
    });

    it('retains the 5-year-step anchor ages that fall outside the band', () => {
        const rows = getAgeTableRows(52, false);
        // 52's band is 47-57, so the 20/25/.../45 and 60/.../80 anchors survive,
        // but the in-band anchors (50) do not need to appear twice.
        expect(rows).toContain(20);
        expect(rows).toContain(80);
    });

    it('includes the entered age exactly once, with no duplicate adjacent row', () => {
        const rows = getAgeTableRows(50, false); // 50 is already an anchor age
        const occurrences = rows.filter(a => a === 50).length;
        expect(occurrences).toBe(1);
    });

    it('every row falls inside [MIN_AGE, MAX_AGE]', () => {
        const rows = getAgeTableRows(52, false);
        for (const a of rows) {
            expect(a).toBeGreaterThanOrEqual(MIN_AGE);
            expect(a).toBeLessThanOrEqual(MAX_AGE);
        }
    });

    it('clamps the band at the lower bound (age near MIN_AGE) without producing out-of-range ages', () => {
        const rows = getAgeTableRows(6, false);
        expect(Math.min(...rows)).toBe(MIN_AGE);
        for (const a of rows) expect(a).toBeGreaterThanOrEqual(MIN_AGE);
        expect(rows.filter(a => a === 6).length).toBe(1);
    });

    it('clamps the band at the upper bound (age near MAX_AGE) without producing out-of-range ages', () => {
        const rows = getAgeTableRows(98, false);
        expect(Math.max(...rows)).toBe(MAX_AGE);
        for (const a of rows) expect(a).toBeLessThanOrEqual(MAX_AGE);
        expect(rows.filter(a => a === 98).length).toBe(1);
    });

    it('returns a sorted, deduplicated list', () => {
        const rows = getAgeTableRows(33, false);
        const sorted = [...rows].sort((a, b) => a - b);
        expect(rows).toEqual(sorted);
        expect(new Set(rows).size).toBe(rows.length);
    });
});

describe('getAgeTableRows — expanded (full) view', () => {
    it('returns every year from MIN_AGE to MAX_AGE inclusive', () => {
        const rows = getAgeTableRows(52, true);
        expect(rows[0]).toBe(MIN_AGE);
        expect(rows[rows.length - 1]).toBe(MAX_AGE);
        expect(rows.length).toBe(MAX_AGE - MIN_AGE + 1);
    });

    it('is unaffected by the entered age', () => {
        expect(getAgeTableRows(20, true)).toEqual(getAgeTableRows(80, true));
    });
});

describe('AGE_TABLE_ANCHOR_ROWS', () => {
    it('stays within the real data bounds', () => {
        for (const a of AGE_TABLE_ANCHOR_ROWS) {
            expect(a).toBeGreaterThanOrEqual(MIN_AGE);
            expect(a).toBeLessThanOrEqual(MAX_AGE);
        }
    });
});

describe('calculateAgeGrade — unchanged behavior well inside the old range', () => {
    it('still returns a sane, non-null result at a mid-range age and distance', () => {
        const seconds = parseTimeToSeconds('40:00')!;
        const result = calculateAgeGrade('male', 45, 10, seconds);
        expect(result).not.toBeNull();
        expect(result!.percentage).toBeGreaterThan(0);
        expect(result!.tier).toBeTruthy();
    });

    it('rejects ages outside the 5-100 guard, unchanged', () => {
        expect(calculateAgeGrade('male', 4, 5, 1200)).toBeNull();
        expect(calculateAgeGrade('male', 101, 5, 1200)).toBeNull();
    });
});

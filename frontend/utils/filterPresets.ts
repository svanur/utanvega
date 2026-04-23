import type { FilterState } from '../hooks/useTrails';

export interface FilterPreset {
    id: string;
    emoji: string;
    nameKey: string; // i18n translation key
    filters: Partial<FilterState>;
    schedule: {
        days?: number[];    // 0=Sun, 1=Mon, ..., 6=Sat
        hours?: [number, number]; // [startHour, endHour) exclusive end
    };
    requiresGeolocation?: boolean;
}

// All possible presets with their time schedules
const ALL_PRESETS: FilterPreset[] = [
    // === Early morning (5–9 AM) ===
    {
        id: 'morning-5k',
        emoji: '☀️',
        nameKey: 'presets.morning5k',
        filters: { minLength: 3, maxLength: 7, maxDuration: 60, maxDistance: 50 },
        schedule: { hours: [5, 9] },
    },
    {
        id: 'sunrise-trail',
        emoji: '🌅',
        nameKey: 'presets.sunriseTrail',
        filters: { maxLength: 10, maxDuration: 90, selectedActivityTypes: ['TrailRunning'] },
        schedule: { hours: [5, 9] },
    },

    // === Mid-morning weekdays (9–12) ===
    {
        id: 'quick-trail',
        emoji: '⚡',
        nameKey: 'presets.quickTrail',
        filters: { maxDuration: 30, maxDistance: 40 },
        schedule: { hours: [9, 12], days: [1, 2, 3, 4, 5] },
    },
    {
        id: 'lunch-run',
        emoji: '🏃',
        nameKey: 'presets.lunchRun',
        filters: { minLength: 5, maxLength: 10, maxDuration: 60, maxDistance: 30, selectedActivityTypes: ['Running', 'TrailRunning'] },
        schedule: { hours: [10, 14], days: [1, 2, 3, 4, 5] },
    },

    // === Saturday morning/midday ===
    {
        id: 'saturday-long-run',
        emoji: '🏔️',
        nameKey: 'presets.saturdayLongRun',
        filters: { minLength: 20, selectedActivityTypes: ['TrailRunning', 'Running'], sortBy: 'longest' },
        schedule: { hours: [6, 14], days: [6] },
    },

    // === Sunday ===
    {
        id: 'sunday-recovery',
        emoji: '🧘',
        nameKey: 'presets.sundayRecovery',
        filters: { difficulty: 'Easy', maxLength: 8, maxDuration: 60, maxDistance: 60 },
        schedule: { hours: [6, 14], days: [0] },
    },

    // === Weekend general (9–17) ===
    {
        id: 'family-hike',
        emoji: '👨‍👩‍👧',
        nameKey: 'presets.familyHike',
        filters: { difficulty: 'Easy', selectedActivityTypes: ['Hiking'], maxDuration: 120 },
        schedule: { hours: [9, 17], days: [0, 6] },
    },
    {
        id: 'weekend-explorer',
        emoji: '🗺️',
        nameKey: 'presets.weekendExplorer',
        filters: { minDuration: 120, maxDuration: 300, sortBy: 'longest' },
        schedule: { hours: [8, 16], days: [0, 6] },
    },

    // === Afternoon weekdays (12–17) ===
    {
        id: 'afternoon-10k',
        emoji: '🌤️',
        nameKey: 'presets.afternoon10k',
        filters: { minLength: 8, maxLength: 15 },
        schedule: { hours: [12, 17], days: [1, 2, 3, 4, 5] },
    },
    {
        id: 'easy-hike',
        emoji: '🥾',
        nameKey: 'presets.easyHike',
        filters: { difficulty: 'Easy', selectedActivityTypes: ['Hiking'] },
        schedule: { hours: [12, 17] },
    },

    // === After work / evening (17–21) ===
    {
        id: 'after-work',
        emoji: '🌆',
        nameKey: 'presets.afterWork',
        filters: { maxDuration: 45, maxDistance: 40 },
        schedule: { hours: [16, 21], days: [1, 2, 3, 4, 5] },
    },
    {
        id: 'evening-trail',
        emoji: '🏞️',
        nameKey: 'presets.eveningTrail',
        filters: { maxDuration: 60, maxLength: 10, maxDistance: 50, selectedActivityTypes: ['TrailRunning', 'Hiking'] },
        schedule: { hours: [17, 21] },
    },

    // === Late night / early morning (21+ or 0–5) ===
    // "Plan Tomorrow" — filters based on what day tomorrow is
    {
        id: 'plan-tomorrow-weekday',
        emoji: '📋',
        nameKey: 'presets.planTomorrow',
        filters: { minLength: 5, maxLength: 15, maxDuration: 90 },
        schedule: { hours: [21, 24], days: [0, 1, 2, 3, 4] }, // Sun–Thu evening → tomorrow is Mon–Fri
    },
    {
        id: 'plan-tomorrow-saturday',
        emoji: '📋',
        nameKey: 'presets.planTomorrow',
        filters: { minLength: 15, maxLength: 42, sortBy: 'longest' },
        schedule: { hours: [21, 24], days: [5] }, // Friday evening → tomorrow is Saturday (long run day)
    },
    {
        id: 'plan-tomorrow-sunday',
        emoji: '📋',
        nameKey: 'presets.planTomorrow',
        filters: { minLength: 8, maxLength: 25, sortBy: 'longest' },
        schedule: { hours: [21, 24], days: [6] }, // Saturday evening → tomorrow is Sunday (recovery/medium)
    },
    // "Can't Sleep" — also day-aware (planning for later today)
    {
        id: 'cant-sleep-weekday',
        emoji: '🌙',
        nameKey: 'presets.cantSleep',
        filters: { minLength: 5, maxLength: 15, maxDuration: 90 },
        schedule: { hours: [0, 5], days: [1, 2, 3, 4, 5] }, // Mon–Fri overnight → run later today (weekday)
    },
    {
        id: 'cant-sleep-weekend',
        emoji: '🌙',
        nameKey: 'presets.cantSleep',
        filters: { minLength: 15, maxLength: 42, sortBy: 'longest' },
        schedule: { hours: [0, 5], days: [0, 6] }, // Sat/Sun overnight → can do a long one today
    },

    // === Always available ===
    {
        id: 'nearby',
        emoji: '📍',
        nameKey: 'presets.nearby',
        filters: { maxDistance: 25, sortBy: 'distance' },
        schedule: {},
        requiresGeolocation: true,
    },
    {
        id: 'short-sweet',
        emoji: '🍬',
        nameKey: 'presets.shortSweet',
        filters: { maxLength: 5, maxDuration: 30, maxDistance: 50, sortBy: 'shortest' },
        schedule: {},
    },
    {
        id: 'big-climb',
        emoji: '⛰️',
        nameKey: 'presets.bigClimb',
        filters: { minElevationGain: 500, sortBy: 'elevation' },
        schedule: {},
    },
    {
        id: 'under-1-hour',
        emoji: '⏱️',
        nameKey: 'presets.under1Hour',
        filters: { maxDuration: 60, maxDistance: 75 },
        schedule: {},
    },
];

function matchesSchedule(preset: FilterPreset, hour: number, day: number): boolean {
    const { schedule } = preset;

    // No schedule constraints = always visible
    if (!schedule.hours && !schedule.days) return true;

    if (schedule.hours) {
        const [start, end] = schedule.hours;
        if (hour < start || hour >= end) return false;
    }

    if (schedule.days) {
        if (!schedule.days.includes(day)) return false;
    }

    return true;
}

/**
 * Returns presets relevant to the current time/day.
 * Always returns 3–5 presets.
 * @param now - Current date/time
 * @param hasGeolocation - Whether user has shared their location
 */
export function getActivePresets(now: Date = new Date(), hasGeolocation: boolean = false): FilterPreset[] {
    const hour = now.getHours();
    const day = now.getDay();

    const matched = ALL_PRESETS
        .filter(p => !p.requiresGeolocation || hasGeolocation)
        .filter(p => matchesSchedule(p, hour, day));

    // Always want at least 3 options — if time-based ones are few, pad with "always" presets
    if (matched.length < 3) {
        const alwaysPresets = ALL_PRESETS.filter(p =>
            !p.schedule.hours && !p.schedule.days &&
            (!p.requiresGeolocation || hasGeolocation)
        );
        for (const p of alwaysPresets) {
            if (!matched.find(m => m.id === p.id)) {
                matched.push(p);
            }
            if (matched.length >= 3) break;
        }
    }

    // Cap at 5 to avoid overwhelming the UI
    return matched.slice(0, 5);
}

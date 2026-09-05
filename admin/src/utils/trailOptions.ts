export const TRAIL_ACTIVITY_TYPES = [
    { value: 'TrailRunning', label: 'Trail Run' },
    { value: 'Running', label: 'Road Run' },
    { value: 'Cycling', label: 'Cycling' },
    { value: 'Hiking', label: 'Hike' },
];

// Superset used by GPX upload flows (single + bulk), where the GPX <type> element can
// carry activity types beyond the four TrailFormCard exposes for manual trail editing.
export const GPX_ACTIVITY_TYPES = [
    { value: 'TrailRunning', label: 'Trail Run' },
    { value: 'Running', label: 'Road Run' },
    { value: 'Cycling', label: 'Cycling' },
    { value: 'Hiking', label: 'Hike' },
    { value: 'FunRun', label: 'Fun Run' },
    { value: 'ObstacleCourse', label: 'Obstacle Course' },
    { value: 'CrossCountryRun', label: 'Cross Country Run' },
    { value: 'Swim', label: 'Swim' },
] as const;

export const TRAIL_DIFFICULTIES = [
    { value: 'Easy', label: 'Easy' },
    { value: 'Moderate', label: 'Moderate' },
    { value: 'Hard', label: 'Hard' },
    { value: 'Expert', label: 'Expert' },
    { value: 'Extreme', label: 'Extreme' },
];

export const TRAIL_TYPES = [
    { value: 'OutAndBack', label: 'Out and Back' },
    { value: 'Loop', label: 'Loop' },
    { value: 'PointToPoint', label: 'Point to Point' },
];

export const TRAIL_VISIBILITIES = [
    { value: 'Public', label: 'Public' },
    { value: 'Friends', label: 'Friends' },
    { value: 'Private', label: 'Private' },
];

export const TRAIL_TERRAIN_TYPES = [
    { value: '', label: 'None' },
    { value: 'Mountainous', label: 'Mountainous' },
    { value: 'Hilly', label: 'Hilly' },
    { value: 'Flat', label: 'Flat' },
];

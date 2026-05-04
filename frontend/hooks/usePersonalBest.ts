import { useMemo } from 'react';
import { useTrailActivities } from './useTrailActivities';

/**
 * Get the personal best (lowest) time for a specific trail.
 * Returns seconds or null if no activities exist.
 */
export function usePersonalBest(trailSlug: string) {
  const { activities } = useTrailActivities(trailSlug);

  return useMemo(() => {
    if (!activities || activities.length === 0) return null;
    const bestTime = Math.min(...activities.map(a => a.TimeInSeconds));
    return bestTime;
  }, [activities]);
}

import type { TrailActivity } from '../hooks/useTrailActivities';

export interface AggregatedTrailActivity {
  slug: string;
  name: string;
  mostRecentActivity: TrailActivity | null;
  bestActivity: TrailActivity | null;
  allActivities: TrailActivity[];
  activityCount: number;
}

export function getCompletedTrailSlugs(
  tickedSlugs: Set<string>,
  activities: TrailActivity[]
): Set<string> {
  return new Set([...tickedSlugs, ...activities.map(a => a.trailSlug)]);
}

export function getCompletedTrailCount(
  tickedSlugs: Set<string>,
  activities: TrailActivity[]
): number {
  return getCompletedTrailSlugs(tickedSlugs, activities).size;
}

export function aggregateTrailActivities(
  tickedSlugs: Set<string>,
  activities: TrailActivity[],
  trailNameMap: Record<string, string>
): AggregatedTrailActivity[] {
  const completedTrailSlugs = getCompletedTrailSlugs(tickedSlugs, activities);

  // Group activities by trail slug
  const trailGroups = Array.from(completedTrailSlugs).map(slug => {
    const trailActivities = activities
      .filter(a => a.trailSlug === slug)
      .sort((a, b) => {
        const dateA = a.logDate ? new Date(a.logDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.logDate ? new Date(b.logDate).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA; // Most recent first
      });
    return {
      slug,
      name: trailNameMap[slug] || slug,
      activities: trailActivities,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Compute mostRecent and bestActivity for each trail
  const aggregated: AggregatedTrailActivity[] = trailGroups.map(trail => {
    const mostRecentActivity = trail.activities.length > 0 ? trail.activities[0] : null;
    
    // Best activity is the one with fastest time (lowest TimeInSeconds)
    const bestActivity = trail.activities.length > 0
      ? trail.activities.reduce((best, current) => 
          current.timeInSeconds < best.timeInSeconds ? current : best
        )
      : null;

    return {
      slug: trail.slug,
      name: trail.name,
      mostRecentActivity,
      bestActivity,
      allActivities: trail.activities,
      activityCount: trail.activities.length,
    };
  });

  return aggregated;
}

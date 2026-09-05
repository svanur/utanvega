import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const USER_ACTIVITIES_CACHE_TTL_MS = 60_000;

export interface TrailActivity {
  id: string;
  userId: string;
  trailSlug: string;
  logDate?: string; // DATE (YYYY-MM-DD)
  timeInSeconds: number; // total seconds
  distance?: number; // km
  elevationGain?: number; // meters
  notes?: string;
  isPublic: boolean;
  loggedAt: string; // ISO timestamp
  updatedAt?: string;
  createdAt: string;
}

interface CreateActivityInput {
  TrailSlug: string;
  LogDate?: string;
  TimeInSeconds: number;
  Distance?: number;
  ElevationGain?: number;
  Notes?: string;
  IsPublic?: boolean;
}

interface UpdateActivityInput {
  LogDate?: string;
  TimeInSeconds?: number;
  Distance?: number;
  ElevationGain?: number;
  Notes?: string;
  IsPublic?: boolean;
}

type ActivitiesCacheEntry = {
  activities: TrailActivity[];
  fetchedAt: number;
};

const userActivitiesCache = new Map<string, ActivitiesCacheEntry>();

const cloneActivities = (activities: TrailActivity[]) => activities.map(a => ({ ...a }));

const setUserActivitiesCache = (userId: string, activities: TrailActivity[]) => {
  userActivitiesCache.set(userId, {
    activities: cloneActivities(activities),
    fetchedAt: Date.now(),
  });
};

export function useTrailActivities(trailSlug?: string) {
      const buildError = async (response: Response, fallback: string) => {
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const body = await response.json() as { 
              detail?: string; 
              message?: string; 
              messageIs?: string;
              title?: string 
            };
            // Try to use the appropriate language message
            const currentLang = localStorage.getItem('utanvega-lang') || 'en';
            const detail = (currentLang === 'is' ? body.messageIs : body.message) 
              || body.message 
              || body.detail 
              || body.title;
            if (detail) return new Error(detail);
          } else {
            const text = (await response.text()).trim();
            if (text) return new Error(text);
          }
        } catch {
          // Ignore parse errors and fall back to status text.
        }
        return new Error(fallback);
      };

  const { user } = useAuth();
  const [activities, setActivities] = useState<TrailActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Get auth token from Supabase session
  const getAuthToken = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      throw new Error('No auth token available');
    }
    return session.access_token;
  }, []);

  // Fetch user's activities from backend API
  const fetchActivities = useCallback(async (options?: { force?: boolean }) => {
    if (!user) {
      userActivitiesCache.clear();
      setActivities([]);
      setLoading(false);
      return;
    }

    const force = options?.force === true;
    const cached = userActivitiesCache.get(user.id);
    const hasFreshCache = !!cached && Date.now() - cached.fetchedAt < USER_ACTIVITIES_CACHE_TTL_MS;

    if (cached) {
      setActivities(cloneActivities(cached.activities));
      if (hasFreshCache && !force) {
        setLoading(false);
        return;
      }
    }

    setLoading(!cached || force);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/v1/user/activities`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw await buildError(response, 'Failed to fetch activities');
      const data = await response.json() as TrailActivity[];
      setActivities(data);
      setUserActivitiesCache(user.id, data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthToken]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const createActivity = useCallback(async (input: CreateActivityInput) => {
    if (!user) return;
    try {
      const token = await getAuthToken();
      const normalizedElevationGain =
        typeof input.ElevationGain === 'number' && Number.isFinite(input.ElevationGain)
          ? Math.max(0, Math.min(2147483647, Math.round(input.ElevationGain)))
          : undefined;
      const response = await fetch(`${API_URL}/api/v1/user/activities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          TrailSlug: input.TrailSlug,
          TimeInSeconds: input.TimeInSeconds,
          Distance: input.Distance,
          ElevationGain: normalizedElevationGain,
          LogDate: input.LogDate,
          Notes: input.Notes,
          IsPublic: input.IsPublic ?? false,
        }),
      });
      if (!response.ok) throw await buildError(response, 'Failed to create activity');
      const data = await response.json() as TrailActivity;
      setActivities(prev => {
        const next = [data, ...prev];
        setUserActivitiesCache(user.id, next);
        return next;
      });
      return data;
    } catch (error) {
      console.error('Failed to create activity:', error);
      throw error;
    }
  }, [user, getAuthToken]);

  const updateActivity = useCallback(async (activityId: string, updates: UpdateActivityInput) => {
    try {
      const token = await getAuthToken();
      const normalizedElevationGain =
        typeof updates.ElevationGain === 'number' && Number.isFinite(updates.ElevationGain)
          ? Math.max(0, Math.min(2147483647, Math.round(updates.ElevationGain)))
          : undefined;
      const response = await fetch(`${API_URL}/api/v1/user/activities/${activityId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updates,
          ElevationGain: normalizedElevationGain,
        }),
      });
      if (!response.ok) throw await buildError(response, 'Failed to update activity');
      const data = await response.json() as TrailActivity;
      setActivities(prev => {
        const next = prev.map(a => a.id === activityId ? data : a);
        if (user?.id) {
          setUserActivitiesCache(user.id, next);
        }
        return next;
      });
      return data;
    } catch (error) {
      console.error('Failed to update activity:', error);
      throw error;
    }
  }, [user?.id, getAuthToken]);

  const deleteActivity = useCallback(async (activityId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/v1/user/activities/${activityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw await buildError(response, 'Failed to delete activity');
      setActivities(prev => {
        const next = prev.filter(a => a.id !== activityId);
        if (user?.id) {
          setUserActivitiesCache(user.id, next);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to delete activity:', error);
      throw error;
    }
  }, [getAuthToken, user?.id]);

  // `trailSlug`, when given, scopes the returned activities to that trail. The fetch/cache above
  // stays per-user (not per-trail) so multiple trail pages share one cache entry; this is a plain
  // client-side filter over that shared list — see usePersonalBest, which was silently returning
  // the user's best time across *all* trails before this filter existed (bug found while fixing
  // the unused-`trailSlug` lint warning, not a pre-existing intentional behaviour).
  const scopedActivities = trailSlug === undefined
    ? activities
    : activities.filter(a => a.trailSlug === trailSlug);

  return {
    activities: scopedActivities,
    loading,
    createActivity,
    updateActivity,
    deleteActivity,
    refetch: () => fetchActivities({ force: true }),
  };
}

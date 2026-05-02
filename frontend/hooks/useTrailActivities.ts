import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface TrailActivity {
  Id: string;
  UserId: string;
  TrailSlug: string;
  Time: number; // seconds
  Distance?: number; // km
  ElevationGain?: number; // meters
  LogDate?: string; // DATE (YYYY-MM-DD)
  Notes?: string;
  IsPublic: boolean;
  LoggedAt: string; // ISO timestamp
  CreatedAt: string;
  UpdatedAt: string;
}

interface CreateActivityInput {
  TrailSlug: string;
  Time: number;
  Distance?: number;
  ElevationGain?: number;
  LogDate?: string;
  Notes?: string;
  IsPublic?: boolean;
  LoggedAt?: string;
}

interface UpdateActivityInput {
  Time?: number;
  Distance?: number;
  ElevationGain?: number;
  LogDate?: string;
  Notes?: string;
  IsPublic?: boolean;
  LoggedAt?: string;
}

export function useTrailActivities(trailSlug?: string) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<TrailActivity[]>([]);
  const [loading, setLoading] = useState(false);

  // Get auth token from Supabase session
  const getAuthToken = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      throw new Error('No auth token available');
    }
    return session.access_token;
  }, []);

  // Fetch user's activities from backend API
  const fetchActivities = useCallback(async () => {
    if (!user) {
      setActivities([]);
      return;
    }
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/v1/user/activities`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch activities: ${response.statusText}`);
      const data = await response.json();
      setActivities(data as TrailActivity[]);
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
      const response = await fetch(`${API_URL}/api/v1/user/activities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          TrailSlug: input.TrailSlug,
          Time: input.Time,
          Distance: input.Distance,
          ElevationGain: input.ElevationGain,
          LogDate: input.LogDate,
          Notes: input.Notes,
          IsPublic: input.IsPublic ?? false,
        }),
      });
      if (!response.ok) throw new Error(`Failed to create activity: ${response.statusText}`);
      const data = await response.json();
      setActivities(prev => [data as TrailActivity, ...prev]);
      return data;
    } catch (error) {
      console.error('Failed to create activity:', error);
      throw error;
    }
  }, [user, getAuthToken]);

  const updateActivity = useCallback(async (activityId: string, updates: UpdateActivityInput) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/v1/user/activities/${activityId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error(`Failed to update activity: ${response.statusText}`);
      const data = await response.json();
      setActivities(prev => prev.map(a => a.Id === activityId ? (data as TrailActivity) : a));
      return data;
    } catch (error) {
      console.error('Failed to update activity:', error);
      throw error;
    }
  }, [getAuthToken]);

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
      if (!response.ok) throw new Error(`Failed to delete activity: ${response.statusText}`);
      setActivities(prev => prev.filter(a => a.Id !== activityId));
    } catch (error) {
      console.error('Failed to delete activity:', error);
      throw error;
    }
  }, [getAuthToken]);

  return { activities, loading, createActivity, updateActivity, deleteActivity, refetch: fetchActivities };
}

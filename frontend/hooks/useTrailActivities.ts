import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

export interface TrailActivity {
  Id: string;
  UserId: string;
  TrailSlug: string;
  Time: number; // seconds
  Notes?: string;
  IsPublic: boolean;
  LoggedAt: string; // ISO timestamp
  CreatedAt: string;
  UpdatedAt: string;
}

interface CreateActivityInput {
  TrailSlug: string;
  Time: number;
  Notes?: string;
  IsPublic?: boolean;
  LoggedAt?: string;
}

interface UpdateActivityInput {
  Time?: number;
  Notes?: string;
  IsPublic?: boolean;
  LoggedAt?: string;
}

export function useTrailActivities(trailSlug?: string) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<TrailActivity[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch user's activities (optionally filtered by trail)
  const fetchActivities = useCallback(async () => {
    if (!user) {
      setActivities([]);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('UserTrailActivities')
        .select('*')
        .eq('UserId', user.id)
        .order('LoggedAt', { ascending: false });

      if (trailSlug) {
        query = query.eq('TrailSlug', trailSlug);
      }

      const { data, error } = await query;
      if (error) throw error;
      setActivities((data ?? []) as TrailActivity[]);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, [user, trailSlug]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const createActivity = useCallback(async (input: CreateActivityInput) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('UserTrailActivities')
        .insert({
          UserId: user.id,
          ...input,
          IsPublic: input.IsPublic ?? false,
          LoggedAt: input.LoggedAt ?? new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      setActivities(prev => [data as TrailActivity, ...prev]);
      return data;
    } catch (error) {
      console.error('Failed to create activity:', error);
      throw error;
    }
  }, [user]);

  const updateActivity = useCallback(async (activityId: string, updates: UpdateActivityInput) => {
    try {
      const { data, error } = await supabase
        .from('UserTrailActivities')
        .update({ ...updates, UpdatedAt: new Date().toISOString() })
        .eq('Id', activityId)
        .select()
        .single();
      if (error) throw error;
      setActivities(prev => prev.map(a => a.Id === activityId ? (data as TrailActivity) : a));
      return data;
    } catch (error) {
      console.error('Failed to update activity:', error);
      throw error;
    }
  }, []);

  const deleteActivity = useCallback(async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('UserTrailActivities')
        .delete()
        .eq('Id', activityId);
      if (error) throw error;
      setActivities(prev => prev.filter(a => a.Id !== activityId));
    } catch (error) {
      console.error('Failed to delete activity:', error);
      throw error;
    }
  }, []);

  return { activities, loading, createActivity, updateActivity, deleteActivity, refetch: fetchActivities };
}

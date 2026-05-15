import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

export interface UserProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): UserProfile {
  return {
    userId: row['UserId'] as string,
    displayName: row['DisplayName'] as string,
    avatarUrl: (row['AvatarUrl'] as string | null) ?? undefined,
    createdAt: row['CreatedAt'] as string,
    updatedAt: row['UpdatedAt'] as string,
  };
}

function getDefaultDisplayName(userId: string): string {
  return `Runner-${userId.replace(/-/g, '').slice(0, 6)}`;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreate = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('Profiles')
      .select('*')
      .eq('UserId', user.id)
      .single();

    if (fetchError?.code === 'PGRST116') {
      // Profile doesn't exist yet — auto-create with a non-email-derived display name
      const displayName = getDefaultDisplayName(user.id);
      const { data: created, error: createError } = await supabase
        .from('Profiles')
        .insert({ UserId: user.id, DisplayName: displayName })
        .select()
        .single();

      if (createError) {
        setError(createError.message);
      } else {
        setProfile(mapRow(created as Record<string, unknown>));
      }
    } else if (fetchError) {
      setError(fetchError.message);
    } else {
      setProfile(mapRow(data as Record<string, unknown>));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrCreate();
  }, [fetchOrCreate]);

  const updateProfile = useCallback(
    async (updates: { displayName?: string; avatarUrl?: string | null }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error: updateError } = await supabase
        .from('Profiles')
        .update({
          ...(updates.displayName !== undefined && { DisplayName: updates.displayName }),
          ...(updates.avatarUrl !== undefined && { AvatarUrl: updates.avatarUrl }),
        })
        .eq('UserId', user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      setProfile(mapRow(data as Record<string, unknown>));
    },
    [user]
  );

  return { profile, loading, error, updateProfile };
}

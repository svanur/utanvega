import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface TrailCheckInEntry {
  id: string;
  trailId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  checkedInAt: string;
  expiresAt: string;
}

interface TrailCheckInsResponse {
  trailId: string;
  entries: TrailCheckInEntry[];
  totalActive: number;
}

async function buildError(response: Response, fallback: string): Promise<Error> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json() as { message?: string; detail?: string; title?: string };
      const detail = body.message || body.detail || body.title;
      if (detail) return new Error(detail);
    } else {
      const text = (await response.text()).trim();
      if (text) return new Error(text);
    }
  } catch {
    // Fall back to default error message.
  }
  return new Error(fallback);
}

export function useTrailCheckIns(trailSlug?: string, enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['trail-checkins', trailSlug];

  const query = useQuery<TrailCheckInsResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/trails/${trailSlug}/checkins`);
      if (!response.ok) throw await buildError(response, 'Failed to fetch trail check-ins');
      const data = await response.json() as TrailCheckInsResponse;
      return {
        ...data,
        entries: (data.entries ?? []).map((entry) => ({
          ...entry,
          avatarUrl: entry.avatarUrl ?? undefined,
        })),
      };
    },
    enabled: !!trailSlug && enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!trailSlug || !enabled) return;

    const channel = supabase
      .channel(`trail-checkins-${trailSlug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'TrailCheckIns' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trail-checkins', trailSlug] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [trailSlug, enabled, queryClient]);

  const getAuthToken = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      throw new Error('No auth token available');
    }
    return session.access_token;
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/v1/trails/${trailSlug}/checkins`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw await buildError(response, 'Failed to check in');
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/v1/trails/${trailSlug}/checkins/me`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw await buildError(response, 'Failed to check out');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const activeEntries = query.data?.entries ?? [];
  const currentUserEntry = user ? activeEntries.find((entry) => entry.userId === user.id) : undefined;

  return {
    entries: activeEntries,
    totalActive: query.data?.totalActive ?? activeEntries.length,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    isCheckedIn: !!currentUserEntry,
    currentUserEntry,
    checkIn: checkInMutation.mutateAsync,
    checkOut: checkOutMutation.mutateAsync,
    saving: checkInMutation.isPending || checkOutMutation.isPending,
  };
}

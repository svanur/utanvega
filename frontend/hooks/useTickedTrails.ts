import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

const TICKED_TRAILS_CACHE_TTL_MS = 60_000;

type TickedTrailsCacheEntry = {
  slugs: string[];
  fetchedAt: number;
};

const tickedTrailsCache = new Map<string, TickedTrailsCacheEntry>();

const setTickedTrailsCache = (userId: string, slugs: Set<string>) => {
  tickedTrailsCache.set(userId, {
    slugs: Array.from(slugs),
    fetchedAt: Date.now(),
  });
};

export function useTickedTrails() {
  const { user } = useAuth();
  const [tickedSlugs, setTickedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch ticked trails on mount or when user changes
  useEffect(() => {
    if (!user) {
      tickedTrailsCache.clear();
      setTickedSlugs(new Set());
      setLoading(false);
      return;
    }

    const cached = tickedTrailsCache.get(user.id);
    const hasFreshCache =
      !!cached && Date.now() - cached.fetchedAt < TICKED_TRAILS_CACHE_TTL_MS;

    if (cached) {
      setTickedSlugs(new Set(cached.slugs));
      if (hasFreshCache) {
        setLoading(false);
        return;
      }
    }

    const fetchTickedTrails = async () => {
      try {
        setLoading(!cached);
        const { data, error } = await supabase
          .from('UserTickedTrails')
          .select('TrailSlug')
          .eq('UserId', user.id);

        if (error) throw error;

        const nextSlugs = new Set((data ?? []).map((r: { TrailSlug: string }) => r.TrailSlug));
        setTickedSlugs(nextSlugs);
        setTickedTrailsCache(user.id, nextSlugs);
      } catch (error) {
        console.error('Error fetching ticked trails:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickedTrails();
  }, [user?.id, user]);

  // Toggle trail as ticked/unticked with optimistic update and rollback on error
  const toggleTick = async (slug: string) => {
    if (!user) return;

    const wasTicked = tickedSlugs.has(slug);
    const previousSlugs = new Set(tickedSlugs);
    const optimisticSlugs = new Set(tickedSlugs);

    try {
      // Optimistic update
      if (wasTicked) {
        optimisticSlugs.delete(slug);
        setTickedSlugs(optimisticSlugs);
        setTickedTrailsCache(user.id, optimisticSlugs);
        await supabase
          .from('UserTickedTrails')
          .delete()
          .eq('UserId', user.id)
          .eq('TrailSlug', slug);
      } else {
        optimisticSlugs.add(slug);
        setTickedSlugs(optimisticSlugs);
        setTickedTrailsCache(user.id, optimisticSlugs);
        await supabase
          .from('UserTickedTrails')
          .insert({ UserId: user.id, TrailSlug: slug });
      }
    } catch (error) {
      // Rollback on error
      setTickedSlugs(previousSlugs);
      setTickedTrailsCache(user.id, previousSlugs);
      console.error('Error toggling trail:', error);
      throw error;
    }
  };

  return { tickedSlugs, loading, toggleTick };
}

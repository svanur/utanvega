import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

export function useTickedTrails() {
  const { user } = useAuth();
  const [tickedSlugs, setTickedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setTickedSlugs(new Set());
      return;
    }
    setLoading(true);
    supabase
      .from('UserTickedTrails')
      .select('TrailSlug')
      .eq('UserId', user.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to fetch ticked trails:', error);
        } else {
          setTickedSlugs(new Set((data ?? []).map((r: { TrailSlug: string }) => r.TrailSlug)));
        }
        setLoading(false);
      });
  }, [user]);

  const isTicked = useCallback((slug: string) => tickedSlugs.has(slug), [tickedSlugs]);

  const toggleTick = useCallback(async (slug: string) => {
    if (!user) return;
    const wasTickedBefore = tickedSlugs.has(slug);
    const previousSet = new Set(tickedSlugs);
    
    try {
      if (wasTickedBefore) {
        setTickedSlugs(prev => { const next = new Set(prev); next.delete(slug); return next; });
        const { error } = await supabase
          .from('UserTickedTrails')
          .delete()
          .eq('UserId', user.id)
          .eq('TrailSlug', slug);
        if (error) throw error;
      } else {
        setTickedSlugs(prev => new Set(prev).add(slug));
        const { error } = await supabase
          .from('UserTickedTrails')
          .insert({ UserId: user.id, TrailSlug: slug });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Failed to toggle tick:', error);
      setTickedSlugs(previousSet); // Rollback on error
      throw error;
    }
  }, [user, tickedSlugs]);

  return { isTicked, toggleTick, loading, tickedSlugs };
}

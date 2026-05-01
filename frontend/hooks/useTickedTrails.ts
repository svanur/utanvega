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
      .then(({ data }) => {
        setTickedSlugs(new Set((data ?? []).map((r: { TrailSlug: string }) => r.TrailSlug)));
        setLoading(false);
      });
  }, [user]);

  const isTicked = useCallback((slug: string) => tickedSlugs.has(slug), [tickedSlugs]);

  const toggleTick = useCallback(async (slug: string) => {
    if (!user) return;
    if (tickedSlugs.has(slug)) {
      setTickedSlugs(prev => { const next = new Set(prev); next.delete(slug); return next; });
      await supabase
        .from('UserTickedTrails')
        .delete()
        .eq('UserId', user.id)
        .eq('TrailSlug', slug);
    } else {
      setTickedSlugs(prev => new Set(prev).add(slug));
      await supabase
        .from('UserTickedTrails')
        .insert({ UserId: user.id, TrailSlug: slug });
    }
  }, [user, tickedSlugs]);

  return { isTicked, toggleTick, loading, tickedSlugs };
}

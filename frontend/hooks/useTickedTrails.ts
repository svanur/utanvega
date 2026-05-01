import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

export function useTickedTrails() {
  const { user } = useAuth();
  const [tickedSlugs, setTickedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch ticked trails on mount or when user changes
  useEffect(() => {
    if (!user) {
      setTickedSlugs(new Set());
      setLoading(false);
      return;
    }

    const fetchTickedTrails = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('UserTickedTrails')
          .select('TrailSlug')
          .eq('UserId', user.id);

        if (error) throw error;

        setTickedSlugs(new Set((data ?? []).map((r: { TrailSlug: string }) => r.TrailSlug)));
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

    try {
      // Optimistic update
      if (wasTicked) {
        setTickedSlugs(prev => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
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
    } catch (error) {
      // Rollback on error
      setTickedSlugs(previousSlugs);
      console.error('Error toggling trail:', error);
      throw error;
    }
  };

  return { tickedSlugs, loading, toggleTick };
}

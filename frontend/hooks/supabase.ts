import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[Auth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Login features are disabled until these are configured.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.local',
  supabaseAnonKey || 'missing-anon-key'
);

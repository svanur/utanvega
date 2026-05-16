import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[Auth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Login features are disabled until these are configured.'
  );
}

let _supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. ' +
      'Check isSupabaseConfigured before calling this function.'
    );
  }

  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!);
  }

  return _supabaseClient;
}

// For convenience, also export as a lazy-evaluated getter property
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});

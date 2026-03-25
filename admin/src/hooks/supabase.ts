import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://honsdscqmhvsoumrcnad.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is missing. Please add it to your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-key');

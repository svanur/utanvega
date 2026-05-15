import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://honsdscqmhvsoumrcnad.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZPNAx60W3n3WzQJHLvQ1BA_hBuTPEns';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

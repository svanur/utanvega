import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://honsdscqmhvsoumrcnad.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvbnNkc2NxbWh2c291bXJjbmFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAzMDczNDAsImV4cCI6MjA0NTg4MzM0MH0.H9qkEhDrz49nh3lCvXfVOuBpBnplEZzPOB3L_C2CPUM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

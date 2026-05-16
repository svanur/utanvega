import { isSupabaseConfigured } from './supabase';
import { useFeatureFlags } from './useFeatureFlags';

/**
 * Hook to check if login is enabled.
 * Login requires both the 'user_login' feature flag AND Supabase to be configured.
 * This centralizes the logic to avoid having login UI reachable when it's not functional.
 */
export function useLoginEnabled(): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled('user_login', false) && isSupabaseConfigured;
}

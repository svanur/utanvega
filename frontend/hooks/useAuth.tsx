import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import { AUTH_PENDING_KEY, AUTH_PENDING_TIMEOUT_MS } from './authConstants';

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }

    let active = true;
    const isAuthPending = () => window.sessionStorage.getItem(AUTH_PENDING_KEY) === '1';

    const clearAuthPending = () => {
      window.sessionStorage.removeItem(AUTH_PENDING_KEY);
    };

    const checkAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const hasOAuthError =
        params.has('error') ||
        params.has('error_code') ||
        params.has('error_description');
      const hasOAuthParams =
        params.has('code') ||
        params.has('state') ||
        hasOAuthError;

      if (hasOAuthError) {
        clearAuthPending();
      }

      // Do NOT manually call exchangeCodeForSession here.
      // The Supabase client is configured with detectSessionInUrl: true + flowType: 'pkce',
      // which automatically exchanges both PKCE codes (?code=) and magic link tokens (?token_hash=).
      // Calling exchangeCodeForSession manually would be a double-exchange (codes are single-use)
      // and creates a race condition with the auto-exchange.

      if (hasOAuthParams) {
        params.delete('code');
        params.delete('state');
        params.delete('error');
        params.delete('error_code');
        params.delete('error_description');
        const newSearch = params.toString();
        const cleanUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl);
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        clearAuthPending();
        setLoading(false);
        return;
      }

      if (!isAuthPending()) {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      setUser(session?.user ?? null);

      if (isAuthPending() && event === 'INITIAL_SESSION' && !session) {
        return;
      }

      if (session?.user || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        clearAuthPending();
        setLoading(false);
      }
    });

    const pendingTimeout = window.setTimeout(() => {
      if (!active) return;
      clearAuthPending();
      setLoading(false);
    }, AUTH_PENDING_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(pendingTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

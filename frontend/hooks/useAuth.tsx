import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_PENDING_KEY = 'utanvega-auth-pending';
const AUTH_PENDING_TIMEOUT_MS = 10000;

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
    const authPending = window.sessionStorage.getItem(AUTH_PENDING_KEY) === '1';

    const clearAuthPending = () => {
      window.sessionStorage.removeItem(AUTH_PENDING_KEY);
    };

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        clearAuthPending();
        setLoading(false);
        return;
      }

      if (!authPending) {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);

      if (authPending && event === 'INITIAL_SESSION' && !session) {
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

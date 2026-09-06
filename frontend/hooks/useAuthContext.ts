import { createContext, useContext } from 'react';
import { User } from '@supabase/supabase-js';

// Split out of useAuth.tsx: that file also exports the AuthProvider component, and a component
// file that also exports a plain hook trips react-refresh/only-export-components. This file
// holds the context + hook; useAuth.tsx holds only the component.
export interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

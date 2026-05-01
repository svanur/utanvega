import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import './i18n/i18n';
import { supabase } from './hooks/supabase';

// Extract OAuth redirect tokens from hash before React Router clears it.
// This allows Supabase to persist the session during client initialization.
const hash = window.location.hash;
if (hash.includes('access_token')) {
  const params = new URLSearchParams(hash.substring(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token') ?? '';
  if (access_token) {
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) console.error('[Auth] setSession error:', error);
      window.history.replaceState({}, document.title, window.location.pathname);
    });
  }
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,  // 5 min default; individual hooks override
            gcTime: 30 * 60 * 1000,     // 30 min — keep unused data for a while
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

// Auto-update SW every hour
registerSW({ immediate: true });

const ReactQueryDevtools = import.meta.env.DEV
    ? React.lazy(() =>
          import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools }))
      )
    : null;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
        <App />
        {ReactQueryDevtools && (
            <React.Suspense fallback={null}>
                <ReactQueryDevtools initialIsOpen={false} />
            </React.Suspense>
        )}
    </QueryClientProvider>
);
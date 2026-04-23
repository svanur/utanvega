import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import './i18n/i18n';

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
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
            {ReactQueryDevtools && (
                <React.Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} />
                </React.Suspense>
            )}
        </QueryClientProvider>
    </React.StrictMode>
);
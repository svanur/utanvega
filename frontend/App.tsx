import { lazy, Suspense, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider, CircularProgress, Box } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { createAppTheme } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import { useEasterEggs } from './hooks/useEasterEggs';
import { EasterEggs } from './components/EasterEggs';
import SpotlightSearch from './components/SpotlightSearch';
import { useFeatureFlags } from './hooks/useFeatureFlags';
import InstallBanner from './components/InstallBanner';
import { useAdminMode } from './hooks/useAdminMode';
import GandalfEntrance from './components/GandalfEntrance';

// Lazy-loaded pages (not needed on initial load)
const TrailDetailsPage = lazy(() => import('./pages/TrailDetailsPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const LocationDetailsPage = lazy(() => import('./pages/LocationDetailsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const DisclaimerPage = lazy(() => import('./pages/DisclaimerPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const FunPage = lazy(() => import('./pages/FunPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const RacesPage = lazy(() => import('./pages/RacesPage'));
const RaceCalendarPage = lazy(() => import('./pages/RaceCalendarPage'));
const CompetitionDetailPage = lazy(() => import('./pages/CompetitionDetailPage'));

function PageLoader() {
    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
            <CircularProgress />
        </Box>
    );
}

function TagPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { slug } = useParams<{ slug: string }>();
    return <HomePage mode={mode} onToggleMode={onToggleMode} tagSlug={slug} />;
}

export default function App() {
    const [mode, setMode] = useState<PaletteMode>(() => {
        const saved = localStorage.getItem('theme-mode');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const theme = useMemo(() => createAppTheme(mode), [mode]);

    const handleToggleMode = () => {
        setMode((current) => {
            const next = current === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme-mode', next);
            return next;
        });
    };

    const { activeEgg, clearEgg } = useEasterEggs();
    const { isEnabled } = useFeatureFlags();
    const { isAdmin, gandalfQuote, dismissGandalf } = useAdminMode();

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ErrorBoundary>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route 
                        path="/" 
                        element={<HomePage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/tags/:slug" 
                        element={<TagPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/trails/:slug" 
                        element={<TrailDetailsPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/locations" 
                        element={<LocationsPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/locations/:slug" 
                        element={<LocationDetailsPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/about" 
                        element={<AboutPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/disclaimer" 
                        element={<DisclaimerPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/privacy" 
                        element={<PrivacyPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    {isAdmin && isEnabled('game_fun_page') && (
                    <Route 
                        path="/fun" 
                        element={<FunPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    )}
                    {isEnabled('tools_page') && (
                    <Route 
                        path="/tools/:toolKey?" 
                        element={<ToolsPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    )}
                    {isEnabled('races_page') && (
                    <>
                    <Route 
                        path="/races" 
                        element={<RacesPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/races/calendar" 
                        element={<RaceCalendarPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/races/:slug" 
                        element={<CompetitionDetailPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    </>
                    )}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
                {isEnabled('spotlight_search') && <SpotlightSearch />}
                <InstallBanner />
            </BrowserRouter>
            </ErrorBoundary>
            <EasterEggs activeEgg={activeEgg} onComplete={clearEgg} />
            <GandalfEntrance quote={gandalfQuote} onClose={dismissGandalf} />
        </ThemeProvider>
    );
}
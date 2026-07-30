import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider, CircularProgress, Box } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { createAppTheme } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import { useEasterEggs } from './hooks/useEasterEggs';
import { EasterEggs } from './components/EasterEggs';
import SpotlightSearch from './components/SpotlightSearch';
import { useFeatureFlags } from './hooks/useFeatureFlags';
import { useLoginEnabled } from './hooks/useLoginEnabled';
import InstallBanner from './components/InstallBanner';
import { AuthProvider } from './hooks/useAuth';

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
const EditionHistoryPage = lazy(() => import('./pages/EditionHistoryPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const TrailComparePage = lazy(() => import('./pages/TrailComparePage'));
const TrailLeaderboardPage = lazy(() => import('./pages/TrailLeaderboardPage'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const MyProfileSettingsPage = lazy(() => import('./pages/MyProfileSettingsPage'));
const MyTrailsPage = lazy(() => import('./pages/MyTrailsPage'));
const MyTrailDetailsPage = lazy(() => import('./pages/MyTrailDetailsPage'));
const ScratchCardPage = lazy(() => import('./pages/ScratchCardPage'));
const RunningTripPage = lazy(() => import('./pages/RunningTripPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ChallengePage = lazy(() => import('./pages/ChallengePage'));
const AnnualReportPage = lazy(() => import('./pages/AnnualReportPage'));
const NewsletterPage = lazy(() => import('./pages/NewsletterPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ItraGuidePage = lazy(() => import('./pages/ItraGuidePage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));

function PageLoader() {
    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
            <CircularProgress />
        </Box>
    );
}

function ScrollToContent() {
    const { pathname } = useLocation();
    useEffect(() => {
        const id = setTimeout(() => {
            const el = document.getElementById('main-content');
            if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
        }, 50);
        return () => clearTimeout(id);
    }, [pathname]);
    return null;
}

function TagPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { slug } = useParams<{ slug: string }>();
    return <HomePage mode={mode} onToggleMode={onToggleMode} tagSlug={slug} />;
}

function RacesSlugRedirect() {
    const { slug } = useParams<{ slug: string }>();
    return <Navigate to={`/events/${slug}`} replace />;
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
    const { isEnabled, loaded } = useFeatureFlags();
    const loginEnabled = useLoginEnabled();

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ErrorBoundary>
                <AuthProvider>
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        <ScrollToContent />
                        <Suspense fallback={<PageLoader />}>
                {!loaded ? (
                    <PageLoader />
                ) : (
                <Routes>
                    <Route
                        path="/"
                        element={
                            isEnabled('races_page')
                                ? <RacesPage mode={mode} onToggleMode={handleToggleMode} showQuote />
                                : <HomePage mode={mode} onToggleMode={handleToggleMode} showQuote />
                        }
                    />
                    {isEnabled('trails_page') && <Route
                        path="/trails"
                        element={<HomePage mode={mode} onToggleMode={handleToggleMode} showQuote={false} />}
                    />}
    {isEnabled('tags_page') && <Route 
                        path="/tags/:slug" 
                        element={<TagPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />}
                    <Route 
                        path="/trails/:slug" 
                        element={<TrailDetailsPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    {isEnabled('trail_leaderboard', false) && <Route
                        path="/trails/:slug/leaderboard"
                        element={<TrailLeaderboardPage mode={mode} onToggleMode={handleToggleMode} />}
                    />}
                    {isEnabled('locations_page') && <Route 
                        path="/locations" 
                        element={<LocationsPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />}
                    {isEnabled('locations_page') && <Route 
                        path="/locations/:slug" 
                        element={<LocationDetailsPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />}
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
                    {isEnabled('game_fun_page') && (
                    <Route
                        path="/fun/:game?"
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
                        path="/events" 
                        element={<RacesPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/events/calendar" 
                        element={<RaceCalendarPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/events/:slug" 
                        element={<CompetitionDetailPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    <Route 
                        path="/events/:slug/history/:editionKey" 
                        element={<EditionHistoryPage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    {/* Legacy redirects */}
                    <Route path="/races" element={<Navigate to="/events" replace />} />
                    <Route path="/races/calendar" element={<Navigate to="/events/calendar" replace />} />
                    <Route path="/races/:slug" element={<RacesSlugRedirect />} />
                    </>
                    )}
                    <Route 
                        path="/welcome" 
                        element={<WelcomePage mode={mode} onToggleMode={handleToggleMode} forceLang="en" />} 
                    />
                    {isEnabled('trail_comparison') && (
                    <Route 
                        path="/compare" 
                        element={<TrailComparePage mode={mode} onToggleMode={handleToggleMode} />} 
                    />
                    )}
                    <Route 
                        path="/velkomin" 
                        element={<WelcomePage mode={mode} onToggleMode={handleToggleMode} forceLang="is" />} 
                    />
                    {loginEnabled && <Route
                        path="/my/profile"
                        element={<MyProfilePage mode={mode} onToggleMode={handleToggleMode} />}
                    />}
                    {loginEnabled && <Route
                        path="/my/profile/settings"
                        element={<MyProfileSettingsPage mode={mode} onToggleMode={handleToggleMode} />}
                    />}
                    {isEnabled('trail_activities', false) && <Route
                        path="/my/trails"
                        element={<MyTrailsPage mode={mode} onToggleMode={handleToggleMode} />}
                    />}
                    {isEnabled('trail_activities', false) && <Route
                        path="/my/trails/:slug"
                        element={<MyTrailDetailsPage mode={mode} onToggleMode={handleToggleMode} />}
                    />}
                    <Route path="/shop/skafkort/2025" element={<ScratchCardPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/shop/hlaupaferd" element={<RunningTripPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/services" element={<ServicesPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/challenge/2026" element={<ChallengePage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/about-us" element={<Navigate to="/about" replace />} />
                    <Route path="/annual-report/2025" element={<AnnualReportPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/newsletter" element={<NewsletterPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/contact" element={<ContactPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/itra-guide" element={<ItraGuidePage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/faq" element={<FaqPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                )}
                </Suspense>
                {isEnabled('spotlight_search') && <SpotlightSearch />}
                <InstallBanner />
                    </BrowserRouter>
                </AuthProvider>
            </ErrorBoundary>
            <EasterEggs activeEgg={activeEgg} onComplete={clearEgg} />
        </ThemeProvider>
    );
}

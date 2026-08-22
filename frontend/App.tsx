import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider, Box } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { createAppTheme } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import { useEasterEggs } from './hooks/useEasterEggs';
import { useKeepWarm } from './hooks/useKeepWarm';
import { EasterEggs } from './components/EasterEggs';
import SpotlightSearch from './components/SpotlightSearch';
import { useFeatureFlags } from './hooks/useFeatureFlags';
import { useLoginEnabled } from './hooks/useLoginEnabled';
import InstallBanner from './components/InstallBanner';
import RunningLoader from './components/RunningLoader';
import { AuthProvider } from './hooks/useAuth';

// Lazy-loaded pages (not needed on initial load)
const HomePage = lazy(() => import('./pages/HomePage'));
const TrailDetailsPage = lazy(() => import('./pages/TrailDetailsPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const LocationDetailsPage = lazy(() => import('./pages/LocationDetailsPage'));
const OrganizerDetailPage = lazy(() => import('./pages/OrganizerDetailPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const MediaPage = lazy(() => import('./pages/MediaPage'));
const DisclaimerPage = lazy(() => import('./pages/DisclaimerPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const FunPage = lazy(() => import('./pages/FunPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const RacesPage = lazy(() => import('./pages/RacesPage'));
const RaceCalendarPage = lazy(() => import('./pages/RaceCalendarPage'));
const CompetitionDetailPage = lazy(() => import('./pages/CompetitionDetailPage'));
const EditionHistoryPage = lazy(() => import('./pages/EditionHistoryPage'));
const EditionsHistoryPage = lazy(() => import('./pages/EditionsHistoryPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const TrailComparePage = lazy(() => import('./pages/TrailComparePage'));
const TrailLeaderboardPage = lazy(() => import('./pages/TrailLeaderboardPage'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const MyProfileSettingsPage = lazy(() => import('./pages/MyProfileSettingsPage'));
const MyTrailsPage = lazy(() => import('./pages/MyTrailsPage'));
const MyTrailDetailsPage = lazy(() => import('./pages/MyTrailDetailsPage'));
const ScratchCardPage = lazy(() => import('./pages/ScratchCardPage'));
const RunningTripsPage = lazy(() => import('./pages/RunningTripsPage'));
const RunningTrip2026Switzerland = lazy(() => import('./pages/RunningTrip2026Switzerland'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ChallengePage = lazy(() => import('./pages/ChallengePage'));
const AnnualReportPage = lazy(() => import('./pages/AnnualReportPage'));
const NewsletterPage = lazy(() => import('./pages/NewsletterPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ItraPage = lazy(() => import('./pages/ItraPage'));
const ItraGuidePage = lazy(() => import('./pages/ItraGuidePage'));
const ItraHandbookPage = lazy(() => import('./pages/ItraHandbookPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const SendCommentsPage = lazy(() => import('./pages/SendCommentsPage'));

function PageLoader() {
    return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
            <RunningLoader />
        </Box>
    );
}

function ScrollToContent() {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
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

function ExternalRedirect({ to }: { to: string }) {
    useEffect(() => {
        window.location.replace(to);
    }, [to]);
    return <PageLoader />;
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
    const loginEnabled = useLoginEnabled();
    useKeepWarm();

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ErrorBoundary>
                <AuthProvider>
                    <BrowserRouter>
                        <ScrollToContent />
                        <Suspense fallback={<PageLoader />}>
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
                        path="/organizers/:slug"
                        element={<OrganizerDetailPage mode={mode} onToggleMode={handleToggleMode} />}
                    />
                    <Route
                        path="/about"
                        element={<AboutPage mode={mode} onToggleMode={handleToggleMode} />}
                    />
                    <Route
                        path="/media"
                        element={<MediaPage mode={mode} onToggleMode={handleToggleMode} />}
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
                        element={<Navigate to={`/events/calendar/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`} replace />}
                    />
                    <Route
                        path="/events/calendar/:year/:month"
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
                    <Route
                        path="/editions/history/:year?"
                        element={<EditionsHistoryPage mode={mode} onToggleMode={handleToggleMode} />}
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
                    <Route path="/shop/scratch-card/2025" element={<ScratchCardPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/shop/running-trip" element={<RunningTripsPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/shop/running-trip/2026/switzerland" element={<RunningTrip2026Switzerland mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/services" element={<ServicesPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/challenge/2026" element={<ChallengePage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/askorun" element={<ExternalRedirect to="https://passportage.com/p/utivistaaskorun" />} />
                    <Route path="/about-us" element={<Navigate to="/about" replace />} />
                    <Route path="/annual-report/2025" element={<AnnualReportPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/newsletter" element={<NewsletterPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/contact" element={<ContactPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/itra" element={<ItraPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/itra-guide" element={<ItraGuidePage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/itra-handbook" element={<ItraHandbookPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/faq" element={<FaqPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="/pages/send-comments" element={<SendCommentsPage mode={mode} onToggleMode={handleToggleMode} />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
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

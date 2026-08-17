import { Box, CssBaseline, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Container, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Snackbar, Alert, Button, CircularProgress, Link, IconButton, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import MapIcon from '@mui/icons-material/Map';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import BarChartIcon from '@mui/icons-material/BarChart';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FlagIcon from '@mui/icons-material/Flag';
import ViewDayOutlinedIcon from '@mui/icons-material/ViewDayOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PoolIcon from '@mui/icons-material/Pool';
import GroupIcon from '@mui/icons-material/Group';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import { useState, useCallback, lazy, Suspense } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/is';
import { BrowserRouter, useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import TranslateIcon from '@mui/icons-material/Translate';
import GpxUploadDialog from './components/GpxUploadDialog';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import AdminSpotlightSearch from './components/AdminSpotlightSearch';
import type { PageKey } from './types/PageKey';
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useAdminShortcuts, GO_TO_PAGES } from './hooks/useAdminShortcuts';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import FeedbackIcon from '@mui/icons-material/Feedback';

// Lazy-loaded pages (only the active page's chunk needs to load)
const TrailList = lazy(() => import('./pages/TrailList'));
const TrailsListPage = lazy(() => import('./pages/TrailsListPage'));
const TrailDetailPage = lazy(() => import('./pages/TrailDetailPage'));
const LocationList = lazy(() => import('./pages/LocationList').then(m => ({ default: m.LocationList })));
const TrailHealth = lazy(() => import('./pages/TrailHealth'));
const EventHealth = lazy(() => import('./pages/EventHealth'));
const EditionHealth = lazy(() => import('./pages/EditionHealth'));
const TrailMapView = lazy(() => import('./pages/TrailMapView'));
const TagManagement = lazy(() => import('./pages/TagManagement'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const FeatureFlagsPage = lazy(() => import('./pages/FeatureFlagsPage'));
const EventList = lazy(() => import('./pages/EventList'));
const EventsListPage = lazy(() => import('./pages/EventsListPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const HeroThemesPage = lazy(() => import('./pages/HeroThemesPage'));
const SponsorsPage = lazy(() => import('./pages/SponsorsPage'));
const OrganizersPage = lazy(() => import('./pages/OrganizersPage'));
const OrganizerDetailPage = lazy(() => import('./pages/OrganizerDetailPage'));
const PoolsPage = lazy(() => import('./pages/PoolsPage'));
const TranslationHealth = lazy(() => import('./pages/TranslationHealth'));
const RaceDayPage = lazy(() => import('./pages/RaceDayPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2e7d32', // Forest green
    },
    background: {
      default: '#f5f5f5',
    },
  },
});

const DRAWER_WIDTH = 220;
const DRAWER_COLLAPSED = 56;


const PAGE_PATHS: Record<PageKey, string> = {
  dashboard: '/',
  events: '/events',
  trails: '/trails',
  locations: '/locations',
  organizers: '/organizers',
  health: '/health',
  'event-health': '/event-health',
  'edition-health': '/edition-health',
  'translation-health': '/translation-health',
  map: '/map',
  tags: '/tags',
  analytics: '/analytics',
  features: '/features',
  'hero-themes': '/hero-themes',
  'sponsors': '/sponsors',
  'pools': '/pools',
  'race-day': '/race-day',
  feedback: '/feedback',
};

function pathToPage(pathname: string): PageKey {
  if (pathname.startsWith('/events-old') || pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/trails-old') || pathname.startsWith('/trails')) return 'trails';
  if (pathname.startsWith('/organizers')) return 'organizers';
  const entry = Object.entries(PAGE_PATHS).find(([, path]) => path === pathname);
  return (entry?.[0] as PageKey) ?? 'dashboard';
}

function MnemonicLabel({ label, mnemonic }: { label: string; mnemonic?: string }) {
  if (!mnemonic) return <>{label}</>;
  const idx = label.toLowerCase().indexOf(mnemonic.toLowerCase());
  if (idx === -1) return <>{label}</>;
  return (
    <>
      {label.slice(0, idx)}
      <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>{label[idx]}</span>
      {label.slice(idx + 1)}
    </>
  );
}

function AdminContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = pathToPage(location.pathname);
  const setCurrentPage = useCallback((page: PageKey) => navigate(PAGE_PATHS[page]), [navigate]);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [raceDayInitialDate, setRaceDayInitialDate] = useState<string | undefined>(undefined);
  const [createEventIntent, setCreateEventIntent] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [pendingNav, setPendingNav] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: React.ReactNode, severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleFocusSearch = useCallback(() => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
    input?.focus();
  }, []);

  const handleToggleTools = useCallback(() => {
    window.dispatchEvent(new CustomEvent('admin:toggle-tools'));
  }, []);

  useAdminShortcuts({
    onNavigate: setCurrentPage,
    onToggleSidebar: () => setDrawerOpen(prev => !prev),
    onNewTrail: () => { setCurrentPage('trails'); setIsUploadOpen(true); },
    onRefresh: () => setRefreshTrigger(prev => prev + 1),
    onToggleTools: handleToggleTools,
    onShowHelp: () => setShowShortcuts(true),
    onFocusSearch: handleFocusSearch,
    onPendingNavigation: setPendingNav,
    currentPage,
  });

  const notify = (message: React.ReactNode, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleUploadSuccess = (trail?: { id: string, slug: string, name: string }, detectedLocations?: { id: string, name: string, type: string, distanceMeters: number }[]) => {
    if (trail) {
      const locationMsg = detectedLocations && detectedLocations.length > 0
        ? ` → Auto-linked to: ${detectedLocations.map(l => l.name).join(', ')}`
        : '';
      notify(
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2">Trail '{trail.name}' uploaded successfully.{locationMsg}</Typography>
          <Link
            component="button"
            onClick={() => navigate(`/trails/${trail.slug}`)}
            color="inherit"
            sx={{ fontWeight: 'bold', textDecoration: 'underline', verticalAlign: 'baseline', fontSize: 'inherit', p: 0 }}
          >
            View Trail
          </Link>
        </Box>
      );
    } else {
      notify('Trail uploaded successfully');
    }
    setRefreshTrigger(prev => prev + 1);
    setCurrentPage('trails');
  };

  if (authLoading) {
    // Paint the branded header immediately instead of a blank screen while the
    // Supabase session check resolves — we can't know whether to show the login
    // form or the dashboard yet, but we can avoid looking like nothing loaded.
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <img src="/images/hlaupadagskra.avif" alt="Hlaupadagskra logo" style={{ height: 32 }} />
              <Typography variant="h6" noWrap>
                Hlaupadagskra.is
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Authorization is enforced by the backend on every request (app_metadata.role == "admin").
  // This check only avoids showing the admin UI to a logged-in non-admin; it is not the security boundary.
  if (user.app_metadata?.role !== 'admin') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Typography variant="h6">You don't have access to this admin panel.</Typography>
        <Button variant="outlined" onClick={() => signOut()}>Sign out</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(!drawerOpen)} sx={{ mr: 1 }}>
            {drawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
          <Box
            component="button"
            onClick={() => setCurrentPage('dashboard')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, background: 'none', border: 'none', cursor: 'pointer', p: 0, color: 'inherit' }}
          >
            <img src="/images/hlaupadagskra.avif" alt="Hlaupadagskra logo" style={{ height: 32 }} />
            <Typography variant="h6" noWrap>
              Hlaupadagskra.is
            </Typography>
          </Box>
          <Tooltip title="Search (Ctrl+K)">
            <IconButton
              color="inherit"
              size="small"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              sx={{ mr: 1 }}
            >
              <SearchIcon />
              <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.7, border: '1px solid', borderColor: 'inherit', borderRadius: 0.5, px: 0.5, ml: 0.5, lineHeight: 1.6 }}>
                ⌘K
              </Typography>
            </IconButton>
          </Tooltip>
          <Tooltip title="Shortcuts (Ctrl+?)">
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setShowShortcuts(true)}
              sx={{ mr: 1 }}
            >
              <KeyboardIcon />
            </IconButton>
          </Tooltip>
          {user?.email && (
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.85 }}>
              {user.email.split('@')[0]}
            </Typography>
          )}
          <Button color="inherit" onClick={signOut} startIcon={<LogoutIcon />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : DRAWER_COLLAPSED,
          flexShrink: 0,
          transition: 'width 0.2s',
          [`& .MuiDrawer-paper`]: {
            width: drawerOpen ? DRAWER_WIDTH : DRAWER_COLLAPSED,
            boxSizing: 'border-box',
            transition: 'width 0.2s',
            overflowX: 'hidden',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {[
              { key: 'dashboard' as const,          icon: <HomeIcon />,                                      label: 'Home' },
              { key: 'events' as const,              icon: <EmojiEventsIcon />,                               label: 'Events' },
              { key: 'trails' as const,              icon: <DashboardIcon />,                                 label: 'Trails' },
              { key: 'race-day' as const,            icon: <FlagIcon />,                                      label: 'Race Manager' },
              { key: 'locations' as const,           icon: <LocationOnIcon />,                                label: 'Locations' },
              { key: 'organizers' as const,          icon: <GroupIcon />,                                     label: 'Organizers' },
              { key: 'tags' as const,                icon: <LocalOfferIcon />,                                label: 'Tags' },
              { key: 'features' as const,            icon: <ToggleOnIcon />,                                  label: 'Features' },
              { key: 'health' as const,              icon: <HealthAndSafetyIcon />,                           label: 'Trail Health' },
              { key: 'event-health' as const,        icon: <HealthAndSafetyIcon sx={{ color: '#ed6c02' }} />, label: 'Event Health' },
              { key: 'edition-health' as const,      icon: <HealthAndSafetyIcon sx={{ color: '#9c27b0' }} />, label: 'Edition Health' },
              { key: 'translation-health' as const,  icon: <TranslateIcon />,                                 label: 'Translations' },
              { key: 'feedback' as const,            icon: <FeedbackIcon />,                                  label: 'Feedback' },
              { key: 'map' as const,                 icon: <MapIcon />,                                       label: 'Trail Map' },
              { key: 'analytics' as const,           icon: <BarChartIcon />,                                  label: 'Analytics' },
              { key: 'hero-themes' as const,         icon: <ViewDayOutlinedIcon />,                           label: 'Hero Themes' },
              { key: 'sponsors' as const,            icon: <ImageOutlinedIcon />,                             label: 'Sponsors' },
              { key: 'pools' as const,               icon: <PoolIcon />,                                      label: 'Pools' },
            ].map(item => {
              const mnemonic = Object.entries(GO_TO_PAGES).find(([, v]) => v === item.key)?.[0];
              const label = drawerOpen ? <MnemonicLabel label={item.label} mnemonic={mnemonic} /> : null;
              return (
                <ListItem key={item.key} disablePadding>
                  <Tooltip
                    title={drawerOpen ? '' : mnemonic ? `${item.label}  (g ${mnemonic})` : item.label}
                    placement="right"
                  >
                    <ListItemButton
                      selected={currentPage === item.key}
                      onClick={() => setCurrentPage(item.key)}
                      sx={{ justifyContent: drawerOpen ? 'initial' : 'center', px: 2 }}
                    >
                      <ListItemIcon sx={{ minWidth: drawerOpen ? 40 : 'auto', justifyContent: 'center' }}>
                        {item.icon}
                      </ListItemIcon>
                      {drawerOpen && <ListItemText primary={label} />}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, transition: 'margin-left 0.2s' }}>
        <Toolbar />
        <Container maxWidth={false}>
          <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
              <CircularProgress />
            </Box>
          }>
          {currentPage === 'dashboard' ? (
            <DashboardPage
              onNewEvent={() => { setCreateEventIntent(true); setCurrentPage('events'); }}
              onUploadTrail={() => setIsUploadOpen(true)}
              onNavigate={setCurrentPage}
            />
          ) : currentPage === 'trails' ? (
            <Routes>
              <Route path="/trails/:idOrSlug" element={<TrailDetailPage onNotify={notify} />} />
              <Route path="/trails-old" element={<TrailList key={refreshTrigger} onNotify={notify} initialSearch={searchTerm} />} />
              <Route path="/trails" element={<TrailsListPage onNotify={notify} initialSearch={searchTerm} />} />
            </Routes>
          ) : currentPage === 'health' ? (
            <TrailHealth onEditTrail={(id) => navigate(`/trails/${id}`)} onNotify={notify} />
          ) : currentPage === 'event-health' ? (
            <EventHealth onViewEvent={(slug) => { setCurrentPage('events'); navigate(`/events/${slug}`); }} onNotify={notify} />
          ) : currentPage === 'edition-health' ? (
            <EditionHealth onViewEvent={(slug) => { setCurrentPage('events'); navigate(`/events/${slug}`); }} onNotify={notify} />
          ) : currentPage === 'map' ? (
            <TrailMapView onEditTrail={(id) => navigate(`/trails/${id}`)} />
          ) : currentPage === 'tags' ? (
            <TagManagement onNotify={notify} />
          ) : currentPage === 'analytics' ? (
            <AnalyticsPage />
          ) : currentPage === 'features' ? (
            <FeatureFlagsPage onNotify={notify} />
          ) : currentPage === 'events' ? (
            <Routes>
              <Route path="/events/:slug" element={
                <EventDetailPage
                  onNotify={notify}
                  onNavigateToRaceManager={date => { setRaceDayInitialDate(date); setCurrentPage('race-day'); }}
                />
              } />
              <Route path="/events-old" element={
                <EventList
                  onNotify={notify}
                  onViewEventDetail={slug => navigate(`/events/${slug}`)}
                />
              } />
              <Route path="/events" element={
                <EventsListPage
                  onNotify={notify}
                  initialCreate={createEventIntent}
                  onInitialCreateConsumed={() => setCreateEventIntent(false)}
                />
              } />
            </Routes>
          ) : currentPage === 'hero-themes' ? (
            <HeroThemesPage />
          ) : currentPage === 'sponsors' ? (
            <SponsorsPage />
          ) : currentPage === 'pools' ? (
            <PoolsPage />
          ) : currentPage === 'organizers' ? (
            <Routes>
              <Route path="/organizers/:slug" element={<OrganizerDetailPage onNotify={notify} />} />
              <Route path="/organizers" element={<OrganizersPage onNotify={notify} />} />
            </Routes>
          ) : currentPage === 'race-day' ? (
            <RaceDayPage
              onNotify={notify}
              initialDate={raceDayInitialDate}
            />
          ) : currentPage === 'translation-health' ? (
            <TranslationHealth onNotify={notify} />
          ) : currentPage === 'feedback' ? (
            <FeedbackPage onNotify={notify} />
          ) : (
            <LocationList onNotify={notify} />
          )}
          </Suspense>

          <GpxUploadDialog 
              open={isUploadOpen} 
              onClose={() => setIsUploadOpen(false)} 
              onUploadSuccess={handleUploadSuccess}
          />

          <Snackbar
              open={snackbar.open}
              autoHideDuration={6000}
              onClose={handleCloseSnackbar}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
              <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                  {snackbar.message}
              </Alert>
          </Snackbar>

          <Snackbar
              open={pendingNav}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              sx={{ mb: 1, ml: 1 }}
          >
              <Alert severity="info" icon={false} sx={{ py: 0.5, px: 1.5, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  <strong>g</strong> · waiting for key…
              </Alert>
          </Snackbar>
        </Container>
      </Box>
      <AdminSpotlightSearch
        onEditTrail={(id) => navigate(`/trails/${id}`)}
        onEditEvent={(slug) => navigate(`/events/${slug}`)}
        onNavigate={(page) => setCurrentPage(page as PageKey)}
        onFilterTrails={(term) => { setSearchTerm(term); setCurrentPage('trails'); }}
      />
      <KeyboardShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="is">
      <CssBaseline />
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <AdminContent />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

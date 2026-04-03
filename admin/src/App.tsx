import { Box, CssBaseline, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Container, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Fab, Snackbar, Alert, Button, CircularProgress, Link, IconButton, Tooltip } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import MapIcon from '@mui/icons-material/Map';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useState } from 'react';
import TrailList from './pages/TrailList';
import { LocationList } from './pages/LocationList';
import TrailHealth from './pages/TrailHealth';
import TrailMapView from './pages/TrailMapView';
import TagManagement from './pages/TagManagement';
import GpxUploadDialog from './components/GpxUploadDialog';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './hooks/useAuth';

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

function AdminContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<'trails' | 'locations' | 'health' | 'map' | 'tags'>('trails');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: React.ReactNode, severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
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
            onClick={() => setSelectedTrailId(trail.id)}
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
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(!drawerOpen)} sx={{ mr: 1 }}>
            {drawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            🌄 Utanvega Admin
          </Typography>
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
              { key: 'trails' as const, icon: <DashboardIcon />, label: 'All Trails' },
              { key: 'locations' as const, icon: <LocationOnIcon />, label: 'Locations' },
              { key: 'health' as const, icon: <HealthAndSafetyIcon />, label: 'Trail Health' },
              { key: 'map' as const, icon: <MapIcon />, label: 'Trail Map' },
              { key: 'tags' as const, icon: <LocalOfferIcon />, label: 'Tags' },
            ].map(item => (
              <ListItem key={item.key} disablePadding>
                <Tooltip title={drawerOpen ? '' : item.label} placement="right">
                  <ListItemButton
                    selected={currentPage === item.key}
                    onClick={() => setCurrentPage(item.key)}
                    sx={{ justifyContent: drawerOpen ? 'initial' : 'center', px: 2 }}
                  >
                    <ListItemIcon sx={{ minWidth: drawerOpen ? 40 : 'auto', justifyContent: 'center' }}>
                      {item.icon}
                    </ListItemIcon>
                    {drawerOpen && <ListItemText primary={item.label} />}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, transition: 'margin-left 0.2s' }}>
        <Toolbar />
        <Container maxWidth={false}>
          {currentPage === 'trails' ? (
            <TrailList key={`${refreshTrigger}-${selectedTrailId}`} onNotify={notify} initialTrailId={selectedTrailId} />
          ) : currentPage === 'health' ? (
            <TrailHealth onEditTrail={(id) => { setSelectedTrailId(id); setCurrentPage('trails'); }} onNotify={notify} />
          ) : currentPage === 'map' ? (
            <TrailMapView onEditTrail={(id) => { setSelectedTrailId(id); setCurrentPage('trails'); }} />
          ) : currentPage === 'tags' ? (
            <TagManagement onNotify={notify} />
          ) : (
            <LocationList onNotify={notify} />
          )}
          
          {currentPage === 'trails' && (
            <Fab 
                color="primary" 
                aria-label="add" 
                sx={{ position: 'fixed', bottom: 32, right: 32 }}
                onClick={() => setIsUploadOpen(true)}
            >
                <AddCircleIcon />
            </Fab>
          )}

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
        </Container>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <AdminContent />
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

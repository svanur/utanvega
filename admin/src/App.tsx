import { Box, CssBaseline, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Container, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Fab, Snackbar, Alert, Button, CircularProgress, Link } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useState } from 'react';
import TrailList from './pages/TrailList';
import { LocationList } from './pages/LocationList';
import GpxUploadDialog from './components/GpxUploadDialog';
import LoginPage from './pages/LoginPage';
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

const DRAWER_WIDTH = 240;

function AdminContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<'trails' | 'locations'>('trails');
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

  const handleUploadSuccess = (trail?: { id: string, slug: string, name: string }) => {
    if (trail) {
      notify(
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Trail '{trail.name}' uploaded successfully.</Typography>
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
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton selected={currentPage === 'trails'} onClick={() => setCurrentPage('trails')}>
                <ListItemIcon><DashboardIcon /></ListItemIcon>
                <ListItemText primary="All Trails" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton selected={currentPage === 'locations'} onClick={() => setCurrentPage('locations')}>
                <ListItemIcon><LocationOnIcon /></ListItemIcon>
                <ListItemText primary="Locations" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Container maxWidth="lg">
          {currentPage === 'trails' ? (
            <TrailList key={`${refreshTrigger}-${selectedTrailId}`} onNotify={notify} initialTrailId={selectedTrailId} />
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
      <AuthProvider>
        <AdminContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

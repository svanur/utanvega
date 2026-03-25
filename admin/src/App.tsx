import { Box, CssBaseline, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Container, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Fab } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useState } from 'react';
import TrailList from './pages/TrailList';
import GpxUploadDialog from './components/GpxUploadDialog';

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

export default function App() {
  const [currentPage, setCurrentPage] = useState<'list' | 'upload'>('list');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setCurrentPage('list');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              🌄 Utanvega Admin
            </Typography>
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
                <ListItemButton selected={currentPage === 'list'} onClick={() => setCurrentPage('list')}>
                  <ListItemIcon><DashboardIcon /></ListItemIcon>
                  <ListItemText primary="All Trails" />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Toolbar />
          <Container maxWidth="lg">
            <TrailList key={refreshTrigger} />
            <Fab 
                color="primary" 
                aria-label="add" 
                sx={{ position: 'fixed', bottom: 32, right: 32 }}
                onClick={() => setIsUploadOpen(true)}
            >
                <AddCircleIcon />
            </Fab>

            <GpxUploadDialog 
                open={isUploadOpen} 
                onClose={() => setIsUploadOpen(false)} 
                onUploadSuccess={handleUploadSuccess}
            />
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

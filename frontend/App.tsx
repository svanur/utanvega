import { useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createAppTheme } from './theme';
import HomePage from './pages/HomePage';
import TrailDetailsPage from './pages/TrailDetailsPage';
import LocationsPage from './pages/LocationsPage';
import LocationDetailsPage from './pages/LocationDetailsPage';

export default function App() {
    const [mode, setMode] = useState<PaletteMode>('light');

    const theme = useMemo(() => createAppTheme(mode), [mode]);

    const handleToggleMode = () => {
        setMode((current) => (current === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
                <Routes>
                    <Route 
                        path="/" 
                        element={<HomePage mode={mode} onToggleMode={handleToggleMode} />} 
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}
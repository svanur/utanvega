import { useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { createAppTheme } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import TrailDetailsPage from './pages/TrailDetailsPage';
import LocationsPage from './pages/LocationsPage';
import LocationDetailsPage from './pages/LocationDetailsPage';

function TagPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { slug } = useParams<{ slug: string }>();
    return <HomePage mode={mode} onToggleMode={onToggleMode} tagSlug={slug} />;
}

export default function App() {
    const [mode, setMode] = useState<PaletteMode>('light');

    const theme = useMemo(() => createAppTheme(mode), [mode]);

    const handleToggleMode = () => {
        setMode((current) => (current === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ErrorBoundary>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
            </ErrorBoundary>
        </ThemeProvider>
    );
}
import { useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { createAppTheme } from './theme';
import HomePage from './pages/HomePage';

export default function App() {
    const [mode, setMode] = useState<PaletteMode>('light');

    const theme = useMemo(() => createAppTheme(mode), [mode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <HomePage mode={mode} onToggleMode={() => setMode((current) => (current === 'light' ? 'dark' : 'light'))} />
        </ThemeProvider>
    );
}
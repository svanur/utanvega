import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export function createAppTheme(mode: PaletteMode) {
    return createTheme({
        palette: {
            mode,
            primary: {
                main: mode === 'light' ? '#1976d2' : '#90caf9',
            },
            secondary: {
                main: mode === 'light' ? '#9c27b0' : '#ce93d8',
            },
            background: {
                default: mode === 'light' ? '#f6f8fb' : '#0f1115',
                paper: mode === 'light' ? '#ffffff' : '#171a21',
            },
        },
        shape: {
            borderRadius: 14,
        },
        spacing: 8,
        typography: {
            fontFamily: ['Inter', 'Roboto', 'Arial', 'sans-serif'].join(','),
            h1: {
                fontWeight: 800,
                letterSpacing: '-0.04em',
            },
            h4: {
                fontWeight: 700,
                letterSpacing: '-0.02em',
            },
            button: {
                textTransform: 'none',
                fontWeight: 600,
            },
        },
        components: {
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
            },
        },
    });
}
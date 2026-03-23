import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#9c27b0',
        },
    },
    shape: {
        borderRadius: 12,
    },
    typography: {
        fontFamily: ['Inter', 'Roboto', 'Arial', 'sans-serif'].join(','),
        h1: {
            fontWeight: 700,
        },
        h4: {
            fontWeight: 600,
        },
    },
});

export default theme;
import { AppBar, Box, Container, IconButton, Toolbar, Tooltip, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import type { PaletteMode } from '@mui/material';

import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import FooterStatus from './FooterStatus';

type LayoutProps = PropsWithChildren<{
    mode: PaletteMode;
    onToggleMode: () => void;
}>;

export default function Layout({ children, mode, onToggleMode }: LayoutProps) {
    const navigate = useNavigate();

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <AppBar position="sticky" elevation={0}>
                <Toolbar sx={{ gap: 1 }}>
                    <Typography 
                        variant="h6" 
                        component="div" 
                        sx={{ flexGrow: 1, cursor: 'pointer' }} 
                        onClick={() => navigate('/')}
                    >
                        🌄Utanvega🏃‍♂️🚴‍
                    </Typography>

                    <Button color="inherit" onClick={() => navigate('/locations')}>
                        Locations
                    </Button>

                    <Tooltip title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                        <IconButton color="inherit" onClick={onToggleMode} size="small" aria-label="toggle dark mode">
                            {mode === 'light' ? (
                                <DarkModeOutlinedIcon fontSize="small" />
                            ) : (
                                <LightModeOutlinedIcon fontSize="small" />
                            )}
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Container maxWidth="md" sx={{ py: 4, flex: 1 }}>
                {children}
            </Container>

            <FooterStatus />
        </Box>
    );
}

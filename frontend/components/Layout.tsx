import { AppBar, Box, Container, IconButton, Toolbar, Tooltip, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PropsWithChildren } from 'react';
import type { PaletteMode } from '@mui/material';

import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import FooterStatus from './FooterStatus';
import LanguageToggle from './LanguageToggle';

type LayoutProps = PropsWithChildren<{
    mode: PaletteMode;
    onToggleMode: () => void;
}>;

export default function Layout({ children, mode, onToggleMode }: LayoutProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();

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
                        🌄Utanvega🏃‍♂️🏃‍♀️🚴‍
                    </Typography>

                    <Button color="inherit" onClick={() => navigate('/locations')}>
                        {t('nav.locations')}
                    </Button>

                    <Button color="inherit" onClick={() => navigate('/about')}>
                        {t('nav.about')}
                    </Button>

                    <LanguageToggle />

                    <Tooltip title={mode === 'light' ? t('nav.darkMode') : t('nav.lightMode')}>
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

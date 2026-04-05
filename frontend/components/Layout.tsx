import { useState } from 'react';
import { AppBar, Box, Container, IconButton, Toolbar, Tooltip, Typography, Button, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PropsWithChildren } from 'react';
import type { PaletteMode } from '@mui/material';

import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import FooterStatus from './FooterStatus';
import LanguageToggle from './LanguageToggle';

type LayoutProps = PropsWithChildren<{
    mode: PaletteMode;
    onToggleMode: () => void;
}>;

export default function Layout({ children, mode, onToggleMode }: LayoutProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const navItems = [
        { label: t('nav.locations'), path: '/locations' },
        { label: t('nav.about'), path: '/about' },
    ];

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

                    {isMobile ? (
                        <>
                            <IconButton
                                color="inherit"
                                onClick={(e) => setAnchorEl(e.currentTarget)}
                                aria-label="menu"
                            >
                                <MenuIcon />
                            </IconButton>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={() => setAnchorEl(null)}
                            >
                                {navItems.map((item) => (
                                    <MenuItem
                                        key={item.path}
                                        onClick={() => { navigate(item.path); setAnchorEl(null); }}
                                    >
                                        {item.label}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </>
                    ) : (
                        navItems.map((item) => (
                            <Button key={item.path} color="inherit" onClick={() => navigate(item.path)}>
                                {item.label}
                            </Button>
                        ))
                    )}

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

import { useState } from 'react';
import { Box, Container, IconButton, Toolbar, Tooltip, Typography, Button, Menu, MenuItem, useMediaQuery, useTheme, ListItemIcon, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PropsWithChildren } from 'react';
import type { PaletteMode } from '@mui/material';

import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import GetAppIcon from '@mui/icons-material/GetApp';
import FooterStatus from './FooterStatus';
import LanguageToggle from './LanguageToggle';
import DynamicHeader from './DynamicHeader';
import { useHeaderWeather } from '../hooks/useHeaderWeather';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

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
    const weather = useHeaderWeather();
    const { canPrompt, install } = useInstallPrompt();

    const navItems = [
        { label: t('nav.locations'), path: '/locations' },
        { label: t('nav.about'), path: '/about' },
    ];

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <DynamicHeader weather={weather} isDark={mode === 'dark'}>
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
                                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                                aria-label="search"
                                size="small"
                            >
                                <SearchIcon />
                            </IconButton>
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
                                {canPrompt && (
                                    <MenuItem onClick={() => { install(); setAnchorEl(null); }}>
                                        <ListItemIcon><GetAppIcon fontSize="small" /></ListItemIcon>
                                        <ListItemText>{t('install.menuItem')}</ListItemText>
                                    </MenuItem>
                                )}
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

                    {!isMobile && (
                        <Tooltip title={t('spotlight.shortcutHint')}>
                            <IconButton
                                color="inherit"
                                size="small"
                                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                                aria-label="search"
                                sx={{ gap: 0.5, borderRadius: 1, px: 1 }}
                            >
                                <SearchIcon fontSize="small" />
                                <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.7, border: '1px solid', borderColor: 'inherit', borderRadius: 0.5, px: 0.5, lineHeight: 1.6 }}>
                                    ⌘K
                                </Typography>
                            </IconButton>
                        </Tooltip>
                    )}

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
            </DynamicHeader>

            <Container maxWidth="md" sx={{ py: 4, flex: 1 }}>
                {children}
            </Container>

            <FooterStatus />
        </Box>
    );
}

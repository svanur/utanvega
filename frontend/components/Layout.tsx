import { useState } from 'react';
import { Box, ButtonBase, Collapse, Container, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Tooltip, Typography, Button, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PropsWithChildren } from 'react';
import type { PaletteMode } from '@mui/material';

import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import GetAppIcon from '@mui/icons-material/GetApp';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FooterStatus from './FooterStatus';
import LanguageToggle from './LanguageToggle';
import DynamicHeader from './DynamicHeader';
import UserAvatar from './UserAvatar';
import { useHeaderWeather } from '../hooks/useHeaderWeather';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useLoginEnabled } from '../hooks/useLoginEnabled';

interface NavChild {
    label: string;
    path?: string;
    href?: string;
}

interface NavItem {
    key: string;
    label: string;
    path?: string;
    href?: string;
    children?: NavChild[];
}

type LayoutProps = PropsWithChildren<{
    mode: PaletteMode;
    onToggleMode: () => void;
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}>;

function openExternal(href: string) {
    window.open(href, '_blank', 'noopener,noreferrer');
}

export default function Layout({ children, mode, onToggleMode, maxWidth = 'md' }: LayoutProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const weather = useHeaderWeather();
    const { canPrompt, install } = useInstallPrompt();
    const { isEnabled } = useFeatureFlags();
    const loginEnabled = useLoginEnabled();

    // Mobile hamburger menu
    const [mobileAnchor, setMobileAnchor] = useState<null | HTMLElement>(null);
    const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

    // Desktop dropdown: tracks which nav item's dropdown is open
    const [desktopDropdown, setDesktopDropdown] = useState<{ key: string; el: HTMLElement } | null>(null);

    const navItems: NavItem[] = [
        { key: 'events', label: t('nav.events'), path: '/events' },
        ...(isEnabled('trails_page') ? [{ key: 'trails', label: t('nav.trails'), path: '/trails' }] : []),
        ...(isEnabled('locations_page') ? [{ key: 'locations', label: t('nav.locations'), path: '/locations' }] : []),
        ...(isEnabled('tools_page') ? [{ key: 'tools', label: t('tools.title'), path: '/tools' }] : []),
        ...(isEnabled('game_fun_page') ? [{ key: 'fun', label: t('nav.fun'), path: '/fun' }] : []),
        {
            key: 'shop',
            label: t('nav.onlineStore'),
            children: [
                { label: t('nav.scratchCard'), path: '/shop/skrafkort/2025' },
                { label: t('nav.runningTrip'), path: '/shop/hlaupaferd' },
            ],
        },
        { key: 'services', label: t('nav.services'), path: '/services' },
        { key: 'challenge', label: t('nav.challenge'), path: '/challenge/2026' },
        {
            key: 'about',
            label: t('nav.about'),
            children: [
                { label: t('nav.aboutUs'), path: '/about' },
                { label: t('nav.runs360'), href: 'https://www.youtube.com/@360RunsIceland' },
                { label: t('nav.annualReport'), path: '/annual-report/2025' },
            ],
        },
    ];

    function handleNavAction(item: NavChild | NavItem) {
        if (item.path) navigate(item.path);
        else if (item.href) openExternal(item.href);
    }

    // Desktop: item click — open dropdown if has children, else navigate
    function handleDesktopItemClick(item: NavItem, el: HTMLElement) {
        if (item.children) {
            setDesktopDropdown({ key: item.key, el });
        } else {
            handleNavAction(item);
        }
    }

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <DynamicHeader weather={weather} isDark={mode === 'dark'}>
                <Toolbar sx={{ gap: 1 }}>
                    <ButtonBase
                        onClick={() => navigate('/events')}
                        sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start', borderRadius: 1 }}
                        aria-label="Go to Races"
                    >
                        <img src="/images/hlaupadagskra.avif" alt="" style={{ height: 32, width: 'auto' }} />
                        <Typography variant="h6" component="div">
                            Hlaupadagskra.is
                        </Typography>
                    </ButtonBase>

                    {isMobile ? (
                        <>
                            {isEnabled('spotlight_search') && (
                                <IconButton
                                    color="inherit"
                                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                                    aria-label="search"
                                    size="small"
                                >
                                    <SearchIcon />
                                </IconButton>
                            )}
                            <IconButton color="inherit" onClick={(e) => setMobileAnchor(e.currentTarget)} aria-label="menu">
                                <MenuIcon />
                            </IconButton>
                            <Menu
                                anchorEl={mobileAnchor}
                                open={Boolean(mobileAnchor)}
                                onClose={() => { setMobileAnchor(null); setMobileExpanded(null); }}
                                slotProps={{ paper: { sx: { minWidth: 220 } } }}
                            >
                                {navItems.map((item) => [
                                    item.children ? (
                                        <MenuItem
                                            key={item.key}
                                            onClick={() => setMobileExpanded(mobileExpanded === item.key ? null : item.key)}
                                        >
                                            <ListItemText>{item.label}</ListItemText>
                                            {mobileExpanded === item.key ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        </MenuItem>
                                    ) : (
                                        <MenuItem
                                            key={item.key}
                                            onClick={() => { handleNavAction(item); setMobileAnchor(null); setMobileExpanded(null); }}
                                        >
                                            <ListItemText>{item.label}</ListItemText>
                                            {item.href && <OpenInNewIcon fontSize="small" sx={{ opacity: 0.5, ml: 0.5 }} />}
                                        </MenuItem>
                                    ),
                                    item.children && (
                                        <Collapse key={`${item.key}-collapse`} in={mobileExpanded === item.key} timeout="auto" unmountOnExit>
                                            <List disablePadding>
                                                {item.children.map((child) => (
                                                    <ListItemButton
                                                        key={child.label}
                                                        sx={{ pl: 4 }}
                                                        onClick={() => { handleNavAction(child); setMobileAnchor(null); setMobileExpanded(null); }}
                                                    >
                                                        <ListItemText primary={child.label} primaryTypographyProps={{ variant: 'body2' }} />
                                                        {child.href && <OpenInNewIcon fontSize="small" sx={{ opacity: 0.5 }} />}
                                                    </ListItemButton>
                                                ))}
                                            </List>
                                            <Divider />
                                        </Collapse>
                                    ),
                                ])}
                                {canPrompt && (
                                    <MenuItem onClick={() => { install(); setMobileAnchor(null); }}>
                                        <ListItemIcon><GetAppIcon fontSize="small" /></ListItemIcon>
                                        <ListItemText>{t('install.menuItem')}</ListItemText>
                                    </MenuItem>
                                )}
                            </Menu>
                        </>
                    ) : (
                        <>
                            {navItems.map((item) => (
                                <Button
                                    key={item.key}
                                    color="inherit"
                                    onClick={(e) => handleDesktopItemClick(item, e.currentTarget)}
                                    endIcon={item.children ? <ExpandMoreIcon fontSize="small" /> : undefined}
                                >
                                    {item.label}
                                </Button>
                            ))}
                            {/* Desktop dropdown */}
                            <Menu
                                anchorEl={desktopDropdown?.el}
                                open={Boolean(desktopDropdown)}
                                onClose={() => setDesktopDropdown(null)}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                            >
                                {desktopDropdown && navItems
                                    .find(i => i.key === desktopDropdown.key)
                                    ?.children?.map((child) => (
                                        <MenuItem
                                            key={child.label}
                                            onClick={() => { handleNavAction(child); setDesktopDropdown(null); }}
                                            sx={{ gap: 1 }}
                                        >
                                            {child.label}
                                            {child.href && <OpenInNewIcon fontSize="small" sx={{ opacity: 0.5 }} />}
                                        </MenuItem>
                                    ))
                                }
                            </Menu>
                        </>
                    )}

                    <LanguageToggle />

                    {!isMobile && isEnabled('spotlight_search') && (
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
                            {mode === 'light' ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>

                    {loginEnabled && <UserAvatar />}
                </Toolbar>
            </DynamicHeader>

            <Container maxWidth={maxWidth} sx={{ py: 4, flex: 1 }}>
                {children}
            </Container>

            <FooterStatus />
        </Box>
    );
}

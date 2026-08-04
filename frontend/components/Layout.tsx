import { useState, useEffect } from 'react';
import { Box, ButtonBase, Collapse, Container, Divider, Fab, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Tooltip, Typography, Button, Menu, MenuItem, useMediaQuery, useTheme, Zoom } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PropsWithChildren, ReactNode } from 'react';
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
import AnnouncementBanner from './AnnouncementBanner';
import HeroBand from './HeroBand';
import EventDayBanner from './EventDayBanner';
import SponsorStrip from './SponsorStrip';
import PromoStrip from './PromoStrip';
import { useHeroTheme } from '../hooks/useHeroTheme';
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
    bottomContent?: ReactNode;
}>;

function openExternal(href: string) {
    window.open(href, '_blank', 'noopener,noreferrer');
}

function ScrollToTopButton() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 300);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <Zoom in={visible}>
            <Fab
                size="small"
                color="primary"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                sx={{ position: 'fixed', bottom: 24, right: 16, zIndex: 1200 }}
                aria-label="scroll to top"
            >
                <KeyboardArrowUpIcon />
            </Fab>
        </Zoom>
    );
}

export default function Layout({ children, mode, onToggleMode, maxWidth = 'md', bottomContent }: LayoutProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const weather = useHeaderWeather();
    const heroTheme = useHeroTheme();
    const { canPrompt, install } = useInstallPrompt();
    const { isEnabled } = useFeatureFlags();
    const loginEnabled = useLoginEnabled();

    // Mobile hamburger menu
    const [mobileAnchor, setMobileAnchor] = useState<null | HTMLElement>(null);
    const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

    // Desktop dropdown: tracks which nav item's dropdown is open
    const [desktopDropdown, setDesktopDropdown] = useState<{ key: string; el: HTMLElement } | null>(null);

    const trailsChildren = [
        { label: t('nav.allTrails'), path: '/trails' },
        ...(isEnabled('locations_page') ? [{ label: t('nav.locations'), path: '/locations' }] : []),
    ];

    const navItems: NavItem[] = [
        {
            key: 'events',
            label: t('nav.events'),
            children: [
                { label: t('nav.allEvents'), path: '/events' },
                { label: t('nav.eventsCalendar'), path: '/events/calendar' },
            ],
        },
        ...(isEnabled('trails_page')
            ? [{ key: 'trails', label: t('nav.trails'), children: trailsChildren }]
            : []),
        ...(isEnabled('tools_page')
            ? [{ key: 'tools', label: t('nav.tools'), path: '/tools' }]
            : []),
        {
            key: 'shop',
            label: t('nav.onlineStore'),
            children: [
                { label: t('nav.scratchCard'), path: '/shop/skafkort/2025' },
                { label: t('nav.runningTrip'), path: '/shop/running-trip' },
            ],
        },
        { key: 'services', label: t('nav.services'), path: '/services' },
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
                        onClick={() => navigate('/')}
                        sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start', borderRadius: 1 }}
                        aria-label="Go to hlaupadagskra.is"
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

            {isEnabled('announcement_banner') && <AnnouncementBanner />}
            <SponsorStrip position="top" />

            <Container maxWidth={maxWidth} sx={{ py: 4, flex: 1 }}>
                {isEnabled('hero_band') && heroTheme && <Box sx={{ mb: 3 }}><HeroBand theme={heroTheme} isDark={mode === 'dark'} /></Box>}
                <PromoStrip position="top" />
                {isEnabled('event_day_banner') && <EventDayBanner />}
                <div id="main-content" />
                {children}
                <PromoStrip position="bottom" />
            </Container>
            <SponsorStrip position="bottom" />

            {bottomContent}

            <FooterStatus />
            <ScrollToTopButton />
        </Box>
    );
}

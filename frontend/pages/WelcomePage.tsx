import { useEffect, useRef, useState } from 'react';
import { Box, Button, Container, Typography, Paper, useTheme, useMediaQuery, Fade, IconButton, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import HikingIcon from '@mui/icons-material/Hiking';
import PlaceIcon from '@mui/icons-material/Place';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BuildIcon from '@mui/icons-material/Build';
import ShareIcon from '@mui/icons-material/Share';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import TerrainIcon from '@mui/icons-material/Terrain';
import LanguageToggle from '../components/LanguageToggle';
import { API_URL } from '../hooks/useTrails';
import type { PaletteMode } from '@mui/material';

interface Props {
    mode: PaletteMode;
    onToggleMode: () => void;
    forceLang?: string;
}

function useOnScreen(ref: React.RefObject<HTMLElement | null>, threshold = 0.25) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
        }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, [ref, threshold]);
    return visible;
}

function useCountUp(target: number, duration: number, start: boolean) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start || target === 0) return;
        const startTime = performance.now();
        let raf: number;
        function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration, start]);
    return value;
}

interface StatsData {
    trailCount: number;
    totalKm: number;
    totalElevation: number;
    locationCount: number;
    raceCount: number;
}

function useWelcomeStats() {
    const [stats, setStats] = useState<StatsData>({ trailCount: 0, totalKm: 0, totalElevation: 0, locationCount: 0, raceCount: 0 });

    useEffect(() => {
        const ac = new AbortController();
        Promise.all([
            fetch(`${API_URL}/api/v1/trails`, { signal: ac.signal }).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/api/v1/locations`, { signal: ac.signal }).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/api/v1/competitions`, { signal: ac.signal }).then(r => r.ok ? r.json() : []),
        ]).then(([trails, locations, competitions]) => {
            const totalKm = (trails as { length: number }[]).reduce((sum, t) => sum + (t.length || 0), 0) / 1000;
            const totalElev = (trails as { elevationGain: number }[]).reduce((sum, t) => sum + (t.elevationGain || 0), 0);
            const upcoming = (competitions as { nextDate: string | null }[]).filter(c => c.nextDate).length;
            setStats({
                trailCount: trails.length,
                totalKm: Math.round(totalKm),
                totalElevation: Math.round(totalElev),
                locationCount: locations.length,
                raceCount: upcoming,
            });
        }).catch(() => {/* silently fail — stats just stay at 0 */});
        return () => ac.abort();
    }, []);

    return stats;
}

function StatItem({ icon, value, label, started }: { icon: React.ReactNode; value: number; label: string; started: boolean }) {
    const display = useCountUp(value, 1800, started);
    return (
        <Box sx={{ textAlign: 'center', flex: '1 1 0', minWidth: 80 }}>
            <Box sx={{ mb: 0.5, color: 'primary.main', '& .MuiSvgIcon-root': { fontSize: 28 } }}>{icon}</Box>
            <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1 }}>
                {display.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Box>
    );
}

function StatsBar({ stats }: { stats: StatsData }) {
    const ref = useRef<HTMLDivElement>(null);
    const visible = useOnScreen(ref, 0.3);
    const { t } = useTranslation();

    return (
        <Box ref={ref} sx={{ py: 6 }}>
            <Fade in={visible} timeout={800}>
                <Paper
                    elevation={0}
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: { xs: 3, sm: 4 },
                        py: 4,
                        px: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                    }}
                >
                    <StatItem icon={<HikingIcon />} value={stats.trailCount} label={t('welcome.stats.trails')} started={visible} />
                    <StatItem icon={<StraightenIcon />} value={stats.totalKm} label={t('welcome.stats.km')} started={visible} />
                    <StatItem icon={<TerrainIcon />} value={stats.totalElevation} label={t('welcome.stats.elevation')} started={visible} />
                    <StatItem icon={<PlaceIcon />} value={stats.locationCount} label={t('welcome.stats.locations')} started={visible} />
                    <StatItem icon={<EmojiEventsIcon />} value={stats.raceCount} label={t('welcome.stats.races')} started={visible} />
                </Paper>
            </Fade>
        </Box>
    );
}

function FeatureSection({ icon, titleKey, descKey, cta, ctaPath, index, tParams }: {
    icon: React.ReactNode;
    titleKey: string;
    descKey: string;
    cta: string;
    ctaPath: string;
    index: number;
    tParams?: Record<string, string | number>;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const visible = useOnScreen(ref);
    const theme = useTheme();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isEven = index % 2 === 0;

    return (
        <Box ref={ref} sx={{ mb: 6 }}>
            <Fade in={visible} timeout={800} style={{ transitionDelay: '100ms' }}>
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 3, sm: 4 },
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: isEven ? 'row' : 'row-reverse' },
                        alignItems: 'center',
                        gap: 3,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'transform 0.3s, box-shadow 0.3s',
                        '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: theme.shadows[4],
                        },
                    }}
                >
                    <Box
                        sx={{
                            width: { xs: 64, sm: 80 },
                            height: { xs: 64, sm: 80 },
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            flexShrink: 0,
                            fontSize: { xs: 32, sm: 40 },
                            '& .MuiSvgIcon-root': { fontSize: 'inherit' },
                        }}
                    >
                        {icon}
                    </Box>
                    <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                        <Typography variant="h5" fontWeight={700} gutterBottom>
                            {t(titleKey)}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                            {t(descKey, tParams)}
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(ctaPath)}
                            sx={{ borderRadius: 20, px: 3 }}
                        >
                            {t(cta)}
                        </Button>
                    </Box>
                </Paper>
            </Fade>
        </Box>
    );
}

export default function WelcomePage({ mode, onToggleMode, forceLang }: Props) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const confettiFired = useRef(false);
    const stats = useWelcomeStats();

    useEffect(() => {
        if (forceLang && i18n.language !== forceLang) {
            i18n.changeLanguage(forceLang);
            localStorage.setItem('utanvega-lang', forceLang);
        }
    }, [forceLang, i18n]);

    useEffect(() => {
        if (confettiFired.current) return;
        confettiFired.current = true;

        const duration = 2500;
        const end = Date.now() + duration;
        const colors = ['#1976d2', '#9c27b0', '#ff9800', '#4caf50', '#f44336'];

        function frame() {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.6 },
                colors,
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.6 },
                colors,
            });
            if (Date.now() < end) requestAnimationFrame(frame);
        }
        frame();
    }, []);

    const features = [
        { icon: <HikingIcon />, titleKey: 'welcome.trails.title', descKey: 'welcome.trails.desc', cta: 'welcome.trails.cta', ctaPath: '/', tParams: { count: stats.trailCount || '...' } },
        { icon: <PlaceIcon />, titleKey: 'welcome.locations.title', descKey: 'welcome.locations.desc', cta: 'welcome.locations.cta', ctaPath: '/locations' },
        { icon: <EmojiEventsIcon />, titleKey: 'welcome.races.title', descKey: 'welcome.races.desc', cta: 'welcome.races.cta', ctaPath: '/races' },
        { icon: <BuildIcon />, titleKey: 'welcome.tools.title', descKey: 'welcome.tools.desc', cta: 'welcome.tools.cta', ctaPath: '/tools' },
        { icon: <ShareIcon />, titleKey: 'welcome.share.title', descKey: 'welcome.share.desc', cta: 'welcome.share.cta', ctaPath: '/' },
    ];

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
            {/* Top-right controls */}
            <Box sx={{ position: 'fixed', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 0.5 }}>
                <LanguageToggle />
                <Tooltip title={mode === 'light' ? t('nav.darkMode') : t('nav.lightMode')}>
                    <IconButton color="inherit" onClick={onToggleMode} size="small">
                        {mode === 'light' ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Hero section */}
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    px: 3,
                    position: 'relative',
                }}
            >
                <Fade in timeout={1000}>
                    <Typography
                        variant="h1"
                        sx={{
                            fontSize: { xs: '3rem', sm: '4.5rem', md: '6rem' },
                            mb: 1,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        🌄 Utanvega
                    </Typography>
                </Fade>

                <Fade in timeout={1500} style={{ transitionDelay: '300ms' }}>
                    <Typography
                        variant="h5"
                        color="text.secondary"
                        sx={{ mb: 4, maxWidth: 600, fontSize: { xs: '1.1rem', sm: '1.4rem' } }}
                    >
                        {t('welcome.tagline')}
                    </Typography>
                </Fade>

                <Fade in timeout={1500} style={{ transitionDelay: '600ms' }}>
                    <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={() => navigate('/')}
                            sx={{ borderRadius: 20, px: 4, py: 1.5, fontSize: '1.1rem' }}
                        >
                            {t('welcome.startExploring')}
                        </Button>
                    </Box>
                </Fade>

                {/* Scroll indicator */}
                <Fade in timeout={2000} style={{ transitionDelay: '1200ms' }}>
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 40,
                            animation: 'bounce 2s infinite',
                            '@keyframes bounce': {
                                '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
                                '40%': { transform: 'translateY(-12px)' },
                                '60%': { transform: 'translateY(-6px)' },
                            },
                        }}
                    >
                        <ArrowDownwardIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.5 }} />
                    </Box>
                </Fade>
            </Box>

            {/* Stats bar */}
            <Container maxWidth="md">
                <StatsBar stats={stats} />
            </Container>

            {/* Feature sections */}
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Fade in timeout={800}>
                    <Typography
                        variant="h4"
                        textAlign="center"
                        sx={{ mb: 6, fontWeight: 700 }}
                    >
                        {t('welcome.whatCanYouDo')}
                    </Typography>
                </Fade>

                {features.map((f, i) => (
                    <FeatureSection key={f.titleKey} {...f} index={i} />
                ))}

                {/* Final CTA */}
                <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        {t('welcome.readyToRun')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        {t('welcome.readyToRunDesc')}
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={() => navigate('/')}
                        sx={{ borderRadius: 20, px: 5, py: 1.5, fontSize: '1.1rem' }}
                    >
                        {t('welcome.startExploring')} 🏃‍♂️
                    </Button>
                </Box>
            </Container>
        </Box>
    );
}

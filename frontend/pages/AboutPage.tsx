import { Avatar, Box, Chip, Typography, Paper, Divider, Stack } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineDot from '@mui/lab/TimelineDot';
import CodeIcon from '@mui/icons-material/Code';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TimelineIcon from '@mui/icons-material/Timeline';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MapIcon from '@mui/icons-material/Map';
import TuneIcon from '@mui/icons-material/Tune';
import BuildIcon from '@mui/icons-material/Build';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SearchIcon from '@mui/icons-material/Search';
import CasinoIcon from '@mui/icons-material/Casino';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import Layout from '../components/Layout';

interface AboutPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

const changelog = [
    { version: '2.0', date: '2025-11', key: 'v2_0', icon: <TrendingUpIcon />, color: 'secondary' as const },
    { version: '1.9', date: '2025-10', key: 'v1_9', icon: <DirectionsRunIcon />, color: 'primary' as const },
    { version: '1.8', date: '2025-09', key: 'v1_8', icon: <CasinoIcon />, color: 'primary' as const },
    { version: '1.7', date: '2025-08', key: 'v1_7', icon: <PhoneIphoneIcon />, color: 'secondary' as const },
    { version: '1.6', date: '2025-07', key: 'v1_6', icon: <SearchIcon />, color: 'primary' as const },
    { version: '1.5', date: '2025-06', key: 'v1_5', icon: <AutoFixHighIcon />, color: 'primary' as const },
    { version: '1.4', date: '2025-05', key: 'v1_4', icon: <BuildIcon />, color: 'secondary' as const },
    { version: '1.3', date: '2025-04', key: 'v1_3', icon: <TuneIcon />, color: 'primary' as const },
    { version: '1.2', date: '2025-03', key: 'v1_2', icon: <MapIcon />, color: 'secondary' as const },
    { version: '1.1', date: '2025-02', key: 'v1_1', icon: <FavoriteIcon />, color: 'primary' as const },
    { version: '1.0', date: '2025-01', key: 'v1_0', icon: <RocketLaunchIcon />, color: 'secondary' as const },
];

export default function AboutPage({ mode, onToggleMode }: AboutPageProps) {
    const { t } = useTranslation();

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: 720, mx: 'auto' }}>
                {/* About section */}
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {t('about.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('about.description')}
                </Typography>

                {/* Author */}
                <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar
                            src="/images/svanur-utanvega.jpg"
                            alt="Svanur"
                            sx={{ width: 80, height: 80 }}
                        />
                        <Box>
                            <Typography variant="h6" fontWeight="bold">
                                {t('about.authorTitle')}
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                {t('about.authorDescription')}
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: '"Dancing Script", cursive',
                                    fontSize: '1.5rem',
                                    mt: 1.5,
                                    color: 'text.primary',
                                }}
                            >
                                {t('about.authorSignature')}
                            </Typography>
                        </Box>
                    </Stack>
                    {/* Social links placeholder — uncomment when links are available
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Chip label="Instagram" component="a" href="#" clickable size="small" />
                        <Chip label="Strava" component="a" href="#" clickable size="small" />
                    </Stack>
                    */}
                </Paper>

                {/* Tech Stack */}
                <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                        <CodeIcon color="primary" />
                        <Typography variant="h6" fontWeight="bold">
                            {t('about.techTitle')}
                        </Typography>
                    </Stack>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        {t('about.techDescription')}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                        {['React', 'TypeScript', '.NET 9', 'PostgreSQL', 'PostGIS', 'Leaflet', 'MUI', 'Vite'].map((tech) => (
                            <Chip key={tech} label={tech} size="small" variant="outlined" />
                        ))}
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <SmartToyIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                            {t('about.aiDescription')}
                        </Typography>
                    </Stack>
                </Paper>

                <Divider sx={{ mb: 4 }} />

                {/* Timeline */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <TimelineIcon color="primary" />
                    <Typography variant="h5" fontWeight="bold">
                        {t('about.changelogTitle')}
                    </Typography>
                </Stack>

                <Timeline position="alternate">
                    {changelog.map((entry, index) => (
                        <TimelineItem key={entry.key}>
                            <TimelineOppositeContent
                                sx={{ m: 'auto 0', color: 'text.secondary' }}
                            >
                                <Typography variant="body2">
                                    v{entry.version} · {entry.date}
                                </Typography>
                            </TimelineOppositeContent>
                            <TimelineSeparator>
                                <TimelineConnector sx={index === 0 ? { bgcolor: 'transparent' } : undefined} />
                                <TimelineDot color={entry.color}>
                                    {entry.icon}
                                </TimelineDot>
                                <TimelineConnector sx={index === changelog.length - 1 ? { bgcolor: 'transparent' } : undefined} />
                            </TimelineSeparator>
                            <TimelineContent sx={{ py: '12px', px: 2 }}>
                                <Typography variant="h6" component="span">
                                    {t(`about.changelog.${entry.key}.title`)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t(`about.changelog.${entry.key}.description`)}
                                </Typography>
                            </TimelineContent>
                        </TimelineItem>
                    ))}
                </Timeline>
            </Box>
        </Layout>
    );
}

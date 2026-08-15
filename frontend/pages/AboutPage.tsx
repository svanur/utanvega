import { Box, Chip, Typography, Paper, Divider, Stack } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineDot from '@mui/lab/TimelineDot';
import GroupsIcon from '@mui/icons-material/Groups';
import TimelineIcon from '@mui/icons-material/Timeline';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import YouTubeIcon from '@mui/icons-material/YouTube';
import CasinoIcon from '@mui/icons-material/Casino';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Layout from '../components/Layout';

interface AboutPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

const milestones = [
    { date: '2026', key: 'v2_launch', icon: <TrendingUpIcon />, color: 'primary' as const },
    { date: '2025', key: 'scratchcard', icon: <CasinoIcon />, color: 'secondary' as const },
    { date: '2024', key: 'runs360', icon: <YouTubeIcon />, color: 'primary' as const },
    { date: '2024', key: 'launch', icon: <RocketLaunchIcon />, color: 'secondary' as const },
];

export default function AboutPage({ mode, onToggleMode }: AboutPageProps) {
    const { t } = useTranslation();
    usePageTitle(t('nav.about'));

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            {/* Hero banner */}
            <Box
                sx={{
                    position: 'relative',
                    maxWidth: 720,
                    mx: 'auto',
                    width: '100%',
                    height: { xs: 180, sm: 260, md: 320 },
                    borderRadius: 3,
                    overflow: 'hidden',
                    mb: 4,
                }}
            >
                <Box
                    component="img"
                    src="/images/hlaupabraedur.jpg"
                    alt="Hlaupabrœðr"
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center 30%',
                        display: 'block',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: { xs: 20, sm: 28 },
                        left: { xs: 20, sm: 32 },
                    }}
                >
                    <Typography
                        variant="h4"
                        fontWeight="bold"
                        sx={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)', lineHeight: 1.2 }}
                    >
                        {t('about.title')}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ maxWidth: 720, mx: 'auto' }}>
                {/* About section */}
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>
                    {t('about.description')}
                </Typography>

                {/* Author */}
                <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                            component="img"
                            src="/images/hlaupadagskra.avif"
                            alt="hlaupadagskra.is"
                            sx={{ width: 80, height: 80, borderRadius: 2, objectFit: 'contain' }}
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

                {/* About hlaupadagskra.is */}
                <Paper variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                        <GroupsIcon color="primary" />
                        <Typography variant="h6" fontWeight="bold">
                            {t('about.missionTitle')}
                        </Typography>
                    </Stack>
                    <Typography variant="subtitle2" color="primary" fontStyle="italic" sx={{ mb: 1.5 }}>
                        {t('about.missionTagline')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        {t('about.missionDescription')}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                        {(t('about.missionTags', { returnObjects: true }) as string[]).map((tag) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                    </Stack>
                </Paper>

                <Divider sx={{ mb: 4 }} />

                {/* Timeline */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <TimelineIcon color="primary" />
                    <Typography variant="h5" fontWeight="bold">
                        {t('about.historyTitle')}
                    </Typography>
                </Stack>

                <Timeline position="alternate">
                    {milestones.map((entry, index) => (
                        <TimelineItem key={entry.key}>
                            <TimelineOppositeContent
                                sx={{ m: 'auto 0', color: 'text.secondary' }}
                            >
                                <Typography variant="body2">
                                    {entry.date}
                                </Typography>
                            </TimelineOppositeContent>
                            <TimelineSeparator>
                                <TimelineConnector sx={index === 0 ? { bgcolor: 'transparent' } : undefined} />
                                <TimelineDot color={entry.color}>
                                    {entry.icon}
                                </TimelineDot>
                                <TimelineConnector sx={index === milestones.length - 1 ? { bgcolor: 'transparent' } : undefined} />
                            </TimelineSeparator>
                            <TimelineContent sx={{ py: '12px', px: 2 }}>
                                <Typography variant="h6" component="span">
                                    {t(`about.milestones.${entry.key}.title`)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t(`about.milestones.${entry.key}.description`)}
                                </Typography>
                            </TimelineContent>
                        </TimelineItem>
                    ))}
                </Timeline>
            </Box>
        </Layout>
    );
}

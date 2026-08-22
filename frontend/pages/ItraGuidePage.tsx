import { Box, Chip, Divider, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LandscapeIcon from '@mui/icons-material/Landscape';
import TimerIcon from '@mui/icons-material/Timer';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Layout from '../components/Layout';
import { usePageTitle } from '../hooks/usePageTitle';

interface ItraGuidePageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

const ICONS = [
    <DirectionsRunIcon color="primary" />,
    <EmojiEventsIcon color="warning" />,
    <LandscapeIcon color="success" />,
    <TimerIcon color="error" />,
    <LeaderboardIcon color="secondary" />,
];

export default function ItraGuidePage({ mode, onToggleMode }: ItraGuidePageProps) {
    const { t } = useTranslation();
    usePageTitle(t('nav.itraGuide'));

    const concepts = t('itraGuide.concepts', { returnObjects: true }) as {
        title: string;
        badge?: string;
        items: string[];
    }[];

    const tableRows = t('itraGuide.table.rows', { returnObjects: true }) as {
        distance: string;
        elevation: string;
        effortKm: string;
        targetTime: string;
        pace: string;
    }[];

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.explore') }, { label: 'ITRA', to: '/itra' }, { label: t('nav.guide') }]}>
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        {t('itraGuide.title')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                        {t('itraGuide.intro')}
                    </Typography>
                    <Link component={RouterLink} to="/itra-handbook" underline="hover" variant="body2">
                        {t('itraGuide.handbookLink')}
                    </Link>
                </Box>

                {/* Concept cards */}
                <Stack spacing={2} sx={{ mb: 4 }}>
                    {concepts.map((concept, i) => (
                        <Paper key={i} variant="outlined" sx={{ p: 2.5 }}>
                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                <Box sx={{ mt: 0.25, flexShrink: 0 }}>{ICONS[i]}</Box>
                                <Box sx={{ flex: 1 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            {i + 1}. {concept.title}
                                        </Typography>
                                        {concept.badge && (
                                            <Chip label={concept.badge} size="small" color="warning" />
                                        )}
                                    </Stack>
                                    <Stack spacing={0.75}>
                                        {concept.items.map((item, j) => (
                                            <Typography key={j} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                                {item}
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Box>
                            </Stack>
                        </Paper>
                    ))}
                </Stack>

                <Divider sx={{ my: 4 }} />

                {/* 370 section */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                        {t('itraGuide.section370.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.8 }}>
                        {t('itraGuide.section370.p1')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                        {t('itraGuide.section370.p2')}
                    </Typography>
                </Box>

                {/* Target times table */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        {t('itraGuide.table.title')}
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                                    <TableCell>{t('itraGuide.table.distance')}</TableCell>
                                    <TableCell>{t('itraGuide.table.elevation')}</TableCell>
                                    <TableCell>{t('itraGuide.table.effortKm')}</TableCell>
                                    <TableCell>{t('itraGuide.table.targetTime')}</TableCell>
                                    <TableCell>{t('itraGuide.table.pace')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tableRows.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{row.distance}</TableCell>
                                        <TableCell>{row.elevation}</TableCell>
                                        <TableCell>{row.effortKm}</TableCell>
                                        <TableCell><strong>{row.targetTime}</strong></TableCell>
                                        <TableCell>{row.pace}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Divider sx={{ my: 4 }} />

                {/* External links */}
                <Box>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        {t('itraGuide.links.title')}
                    </Typography>
                    <Stack spacing={1}>
                        <Link href="https://itra.run/FAQ/PerformanceIndex" target="_blank" rel="noopener noreferrer"
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            {t('itraGuide.links.faq')} <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </Link>
                        <Link href="https://www.laugavegshlaup.is/skraningilaugavegshlaupid" target="_blank" rel="noopener noreferrer"
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            {t('itraGuide.links.laugavegur')} <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </Link>
                    </Stack>
                </Box>
            </Box>
        </Layout>
    );
}

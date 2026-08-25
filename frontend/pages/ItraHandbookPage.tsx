import { Box, Divider, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import ExploreIcon from '@mui/icons-material/Explore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SecurityIcon from '@mui/icons-material/Security';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Layout from '../components/Layout';
import { usePageTitle } from '../hooks/usePageTitle';

interface ItraHandbookPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ mt: 0.25, flexShrink: 0 }}>{icon}</Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                        {title}
                    </Typography>
                    {children}
                </Box>
            </Stack>
        </Paper>
    );
}

export default function ItraHandbookPage({ mode, onToggleMode }: ItraHandbookPageProps) {
    const { t } = useTranslation();
    usePageTitle(t('nav.itraHandbook'));

    const browseItems = t('itraHandbook.browse.items', { returnObjects: true }) as string[];
    const duplicateItems = t('itraHandbook.duplicate.items', { returnObjects: true }) as string[];
    const mergeSteps = t('itraHandbook.merge.steps', { returnObjects: true }) as string[];
    const freeItems = t('itraHandbook.free.items', { returnObjects: true }) as string[];
    const paidItems = t('itraHandbook.paid.items', { returnObjects: true }) as string[];
    const expiryItems = t('itraHandbook.expiry.items', { returnObjects: true }) as string[];
    const findRacesItems = t('itraHandbook.findRaces.items', { returnObjects: true }) as string[];
    const insuranceBenefits = t('itraHandbook.insurance.benefits', { returnObjects: true }) as string[];

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.explore') }, { label: 'ITRA', to: '/itra' }, { label: t('nav.handbook') }]}>
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                {/* Header */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" fontWeight={700}>
                        {t('itraHandbook.title')}
                    </Typography>
                    <Typography variant="h6" color="text.secondary" fontWeight={400} gutterBottom>
                        {t('itraHandbook.subtitle')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }} gutterBottom>
                        {t('itraHandbook.intro')}
                    </Typography>
                    <Link component={RouterLink} to="/itra-guide" underline="hover" variant="body2">
                        {t('itraHandbook.guideLink')}
                    </Link>
                </Box>

                <Stack spacing={2} sx={{ mb: 4 }}>
                    {/* Browse / no login */}
                    <SectionCard icon={<SearchIcon color="primary" />} title={t('itraHandbook.browse.title')}>
                        <Stack spacing={0.75}>
                            {browseItems.map((item, i) => (
                                <Typography key={i} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                    {item}
                                </Typography>
                            ))}
                            <Link
                                href="https://itra.run/Runners/FindARunner"
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="body2"
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
                            >
                                {t('itraHandbook.browse.findLink')} <OpenInNewIcon sx={{ fontSize: 14 }} />
                            </Link>
                        </Stack>
                    </SectionCard>

                    {/* Find ITRA-certified races */}
                    <SectionCard icon={<ExploreIcon color="success" />} title={t('itraHandbook.findRaces.title')}>
                        <Stack spacing={0.75}>
                            {findRacesItems.map((item, i) => (
                                <Typography key={i} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                    {item}
                                </Typography>
                            ))}
                            <Link
                                href="https://itra.run/Races/FindRace"
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="body2"
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
                            >
                                {t('itraHandbook.findRaces.link')} <OpenInNewIcon sx={{ fontSize: 14 }} />
                            </Link>
                        </Stack>
                    </SectionCard>

                    {/* Duplicate profiles */}
                    <SectionCard icon={<WarningAmberIcon color="warning" />} title={t('itraHandbook.duplicate.title')}>
                        <Stack spacing={0.75}>
                            {duplicateItems.map((item, i) => (
                                <Typography key={i} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                    {item}
                                </Typography>
                            ))}
                        </Stack>
                    </SectionCard>

                    {/* Merge steps */}
                    <SectionCard icon={<MergeTypeIcon color="secondary" />} title={t('itraHandbook.merge.title')}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
                            {t('itraHandbook.merge.intro')}
                        </Typography>
                        <Stack spacing={1}>
                            {mergeSteps.map((step, i) => (
                                <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                                    <Box
                                        sx={{
                                            minWidth: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            bgcolor: 'secondary.main',
                                            color: 'secondary.contrastText',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            flexShrink: 0,
                                            mt: 0.1,
                                        }}
                                    >
                                        {i + 1}
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                        {step}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </SectionCard>

                    {/* Free account */}
                    <SectionCard icon={<PersonAddIcon color="success" />} title={t('itraHandbook.free.title')}>
                        <Stack spacing={0.75}>
                            {freeItems.map((item, i) => (
                                <Typography key={i} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                    {item}
                                </Typography>
                            ))}
                        </Stack>
                    </SectionCard>

                    {/* Paid subscription */}
                    <SectionCard icon={<TrendingUpIcon color="primary" />} title={t('itraHandbook.paid.title')}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.7 }}>
                            {t('itraHandbook.paid.price')}
                        </Typography>
                        <Stack spacing={0.75}>
                            {paidItems.map((item, i) => (
                                <Typography key={i} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                    {item}
                                </Typography>
                            ))}
                        </Stack>
                    </SectionCard>

                    {/* Score expiry */}
                    <SectionCard icon={<HourglassEmptyIcon color="warning" />} title={t('itraHandbook.expiry.title')}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.7 }}>
                            {t('itraHandbook.expiry.intro')}
                        </Typography>
                        <Stack spacing={0.75}>
                            {expiryItems.map((item, i) => (
                                <Typography key={i} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                    {item}
                                </Typography>
                            ))}
                        </Stack>
                    </SectionCard>
                </Stack>

                <Divider sx={{ my: 4 }} />

                {/* Insurance section */}
                <Box sx={{ mb: 4 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                        <SecurityIcon color="error" />
                        <Typography variant="h6" fontWeight={700}>
                            {t('itraHandbook.insurance.title')}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                        {t('itraHandbook.insurance.price')}
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                                    <TableCell width="50%">{t('itraHandbook.insurance.colBenefits')}</TableCell>
                                    <TableCell width="50%">{t('itraHandbook.insurance.colWho')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow sx={{ verticalAlign: 'top' }}>
                                    <TableCell>
                                        <Stack spacing={0.5}>
                                            {insuranceBenefits.map((b, i) => (
                                                <Typography key={i} variant="body2" sx={{ lineHeight: 1.6 }}>
                                                    • {b}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Stack spacing={1}>
                                            <Stack direction="row" spacing={1} alignItems="flex-start">
                                                <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.2, flexShrink: 0 }} />
                                                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                                                    {t('itraHandbook.insurance.goodFor')}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={1} alignItems="flex-start">
                                                <CancelOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
                                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                                    {t('itraHandbook.insurance.notFor')}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', lineHeight: 1.7 }}>
                        {t('itraHandbook.insurance.note')}
                    </Typography>
                </Box>

            </Box>
        </Layout>
    );
}

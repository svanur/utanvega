import type { PaletteMode } from '@mui/material';
import { Box, Typography, Divider, Stack, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

function StatCard({ value, label }: { value: string; label: string }) {
    return (
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color="primary">{value}</Typography>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Paper>
    );
}

export default function AnnualReportPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.annualReport') }]}>
            <Box sx={{ py: 2 }}>
                <Typography variant="overline" color="text.secondary">hlaupadagskra.is</Typography>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t('annualReport.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    {t('annualReport.intro')}
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
                    <StatCard value="141" label={t('annualReport.stat.events')} />
                    <StatCard value=">45.000" label={t('annualReport.stat.registrations')} />
                    <StatCard value="+25%" label={t('annualReport.stat.growth')} />
                    <StatCard value="64" label={t('annualReport.stat.nationalities')} />
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('annualReport.topEventsTitle')}
                </Typography>
                <Stack spacing={1} sx={{ mb: 4 }}>
                    {[
                        { name: 'Reykjavík Marathon', count: '16.119', change: '+22%' },
                        { name: 'Midnight Sun Run', count: '2.347', change: '+11%' },
                        { name: 'New Year\'s Run (ÍR)', count: '1.777', change: '+18%' },
                        { name: 'The Puffin Run', count: '1.334', change: '+20%' },
                        { name: 'Hengill Ultra Trail', count: '1.085', change: '-15%' },
                    ].map((ev) => (
                        <Stack key={ev.name} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2">{ev.name}</Typography>
                            <Stack direction="row" spacing={2}>
                                <Typography variant="body2" fontWeight={600}>{ev.count}</Typography>
                                <Typography variant="body2" color={ev.change.startsWith('+') ? 'success.main' : 'error.main'}>{ev.change}</Typography>
                            </Stack>
                        </Stack>
                    ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('annualReport.highlightsTitle')}
                </Typography>
                <Stack spacing={1.5} sx={{ mb: 4 }}>
                    {[1, 2, 3, 4].map((n) => (
                        <Stack key={n} direction="row" spacing={1.5} alignItems="flex-start">
                            <Typography color="primary" fontWeight={700}>•</Typography>
                            <Typography variant="body1">{t(`annualReport.highlight${n}`)}</Typography>
                        </Stack>
                    ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('annualReport.genderTitle')}
                </Typography>
                <Stack spacing={0.5} sx={{ mb: 4 }}>
                    <Typography variant="body2">👨 {t('annualReport.male')}: 51,1%</Typography>
                    <Typography variant="body2">👩 {t('annualReport.female')}: 48,8%</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('annualReport.genderNote')}</Typography>
                </Stack>

                <Typography variant="caption" color="text.secondary">
                    {t('annualReport.source')}: timataka.is, corsa.is
                </Typography>
            </Box>
        </Layout>
    );
}

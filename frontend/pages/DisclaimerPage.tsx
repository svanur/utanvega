import { Box, Typography, Paper, Divider, Link } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TerrainIcon from '@mui/icons-material/Terrain';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import Layout from '../components/Layout';

interface DisclaimerPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {icon}
                <Typography variant="h6" fontWeight="bold">{title}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {children}
            </Typography>
        </Box>
    );
}

export default function DisclaimerPage({ mode, onToggleMode }: DisclaimerPageProps) {
    const { t } = useTranslation();

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: 700, mx: 'auto', px: 2, py: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <WarningAmberIcon sx={{ fontSize: 32, color: 'warning.main' }} />
                    <Typography variant="h4" fontWeight="bold">
                        {t('disclaimer.title')}
                    </Typography>
                </Box>

                <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                    <Section
                        icon={<TerrainIcon color="primary" />}
                        title={t('disclaimer.useAtOwnRisk.title')}
                    >
                        {t('disclaimer.useAtOwnRisk.body')}
                    </Section>

                    <Divider sx={{ my: 2 }} />

                    <Section
                        icon={<ThermostatIcon color="primary" />}
                        title={t('disclaimer.weather.title')}
                    >
                        {t('disclaimer.weather.body')}
                    </Section>

                    <Divider sx={{ my: 2 }} />

                    <Section
                        icon={<GpsFixedIcon color="primary" />}
                        title={t('disclaimer.accuracy.title')}
                    >
                        {t('disclaimer.accuracy.body')}
                    </Section>

                    <Divider sx={{ my: 2 }} />

                    <Section
                        icon={<LocalHospitalIcon color="error" />}
                        title={t('disclaimer.emergency.title')}
                    >
                        {t('disclaimer.emergency.body')}
                    </Section>

                    <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {t('disclaimer.safetravel')}{' '}
                            <Link href="https://safetravel.is" target="_blank" rel="noopener">
                                safetravel.is
                            </Link>
                        </Typography>
                    </Box>
                </Paper>

                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
                    {t('disclaimer.lastUpdated', { date: '2026-04-07' })}
                </Typography>
            </Box>
        </Layout>
    );
}

import { Box, Typography, Paper, Divider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import StorageIcon from '@mui/icons-material/Storage';
import PhonelinkIcon from '@mui/icons-material/Phonelink';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import Layout from '../components/Layout';

interface PrivacyPageProps {
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

export default function PrivacyPage({ mode, onToggleMode }: PrivacyPageProps) {
    const { t } = useTranslation();

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: 700, mx: 'auto', px: 2, py: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Typography variant="h4" fontWeight="bold">
                        {t('privacy.title')}
                    </Typography>
                </Box>

                <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
                        {t('privacy.intro')}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Section
                        icon={<VisibilityOffIcon color="primary" />}
                        title={t('privacy.noAccounts.title')}
                    >
                        {t('privacy.noAccounts.body')}
                    </Section>

                    <Divider sx={{ my: 2 }} />

                    <Section
                        icon={<StorageIcon color="primary" />}
                        title={t('privacy.viewTracking.title')}
                    >
                        {t('privacy.viewTracking.body')}
                    </Section>

                    <Divider sx={{ my: 2 }} />

                    <Section
                        icon={<PhonelinkIcon color="primary" />}
                        title={t('privacy.localStorage.title')}
                    >
                        {t('privacy.localStorage.body')}
                    </Section>

                    <Divider sx={{ my: 2 }} />

                    <Section
                        icon={<CloudOffIcon color="primary" />}
                        title={t('privacy.thirdParty.title')}
                    >
                        {t('privacy.thirdParty.body')}
                    </Section>

                </Paper>

                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
                    {t('privacy.lastUpdated', { date: '2026-04-07' })}
                </Typography>
            </Box>
        </Layout>
    );
}

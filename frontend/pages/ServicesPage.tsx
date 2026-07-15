import type { PaletteMode } from '@mui/material';
import { Box, Typography, Card, CardContent, Divider, Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import VideocamIcon from '@mui/icons-material/Videocam';
import RouteIcon from '@mui/icons-material/Route';
import CampaignIcon from '@mui/icons-material/Campaign';
import VisibilityIcon from '@mui/icons-material/Visibility';

const services = [
    { icon: <VideocamIcon fontSize="large" color="primary" />, key: 'recording' },
    { icon: <RouteIcon fontSize="large" color="primary" />, key: 'coursePromo' },
    { icon: <CampaignIcon fontSize="large" color="primary" />, key: 'marketing' },
    { icon: <VisibilityIcon fontSize="large" color="primary" />, key: 'visibility' },
];

export default function ServicesPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t('services.title')}
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
                    {t('services.tagline')}
                </Typography>
                <Typography variant="body1" sx={{ mb: 4 }}>
                    {t('services.intro')}
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 4 }}>
                    {services.map(({ icon, key }) => (
                        <Card key={key} variant="outlined">
                            <CardContent>
                                <Stack direction="row" spacing={2} alignItems="flex-start">
                                    {icon}
                                    <Box>
                                        <Typography variant="h6" fontWeight={600} gutterBottom>
                                            {t(`services.${key}.title`)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t(`services.${key}.description`)}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('services.benefitsTitle')}
                </Typography>
                <Stack spacing={1} sx={{ mb: 4 }}>
                    <Typography variant="body2">✓ {t('services.benefit1')}</Typography>
                    <Typography variant="body2">✓ {t('services.benefit2')}</Typography>
                    <Typography variant="body2">✓ {t('services.benefit3')}</Typography>
                    <Typography variant="body2">✓ {t('services.benefit4')}</Typography>
                </Stack>

                <Button
                    variant="contained"
                    size="large"
                    href="mailto:info@hlaupadagskra.is?subject=Þjónusta"
                    sx={{ textTransform: 'none' }}
                >
                    {t('services.contact')}
                </Button>
            </Box>
        </Layout>
    );
}

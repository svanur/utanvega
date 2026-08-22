import { Box, Button, Card, CardActions, CardContent, Stack, Typography } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import Layout from '../components/Layout';
import { usePageTitle } from '../hooks/usePageTitle';

interface ItraPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function ItraPage({ mode, onToggleMode }: ItraPageProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    usePageTitle('ITRA');

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.explore') }, { label: 'ITRA' }]}>
            <Box sx={{ maxWidth: 700, mx: 'auto' }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={700} gutterBottom>ITRA</Typography>
                    <Typography color="text.secondary">{t('itraLanding.intro')}</Typography>
                </Box>
                <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
                    <Card variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flex: 1 }}>
                            <LightbulbOutlinedIcon color="primary" sx={{ mb: 1 }} />
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                {t('itraLanding.guide.title')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('itraLanding.guide.description')}
                            </Typography>
                        </CardContent>
                        <CardActions sx={{ px: 2, pb: 2 }}>
                            <Button variant="contained" size="small" onClick={() => navigate('/itra-guide')}>
                                {t('itraLanding.guide.cta')}
                            </Button>
                        </CardActions>
                    </Card>
                    <Card variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flex: 1 }}>
                            <MenuBookIcon color="secondary" sx={{ mb: 1 }} />
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                {t('itraLanding.handbook.title')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('itraLanding.handbook.description')}
                            </Typography>
                        </CardContent>
                        <CardActions sx={{ px: 2, pb: 2 }}>
                            <Button variant="contained" size="small" onClick={() => navigate('/itra-handbook')}>
                                {t('itraLanding.handbook.cta')}
                            </Button>
                        </CardActions>
                    </Card>
                </Stack>
            </Box>
        </Layout>
    );
}

import type { PaletteMode } from '@mui/material';
import { Box, Typography, Chip, Divider, Button, Stack, Card, CardContent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import EmojiNatureIcon from '@mui/icons-material/EmojiNature';
import PlaceIcon from '@mui/icons-material/Place';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

export default function ChallengePage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.challenge') }]}>
            <Box sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t('challenge.title')}
                </Typography>
                <Typography variant="h6" color="primary" sx={{ mb: 1, fontStyle: 'italic' }}>
                    {t('challenge.tagline')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('challenge.intro')}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 4 }} flexWrap="wrap" useFlexGap>
                    <Chip label={t('challenge.locations100')} color="primary" />
                    <Chip label={t('challenge.capitalRegion')} variant="outlined" />
                    <Chip label={t('challenge.deadline')} variant="outlined" />
                </Stack>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 4 }}>
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                            <PlaceIcon color="primary" fontSize="large" />
                            <Typography variant="h6" fontWeight={600}>{t('challenge.feature1.title')}</Typography>
                            <Typography variant="body2" color="text.secondary">{t('challenge.feature1.desc')}</Typography>
                        </CardContent>
                    </Card>
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                            <EmojiNatureIcon color="primary" fontSize="large" />
                            <Typography variant="h6" fontWeight={600}>{t('challenge.feature2.title')}</Typography>
                            <Typography variant="body2" color="text.secondary">{t('challenge.feature2.desc')}</Typography>
                        </CardContent>
                    </Card>
                    <Card variant="outlined">
                        <CardContent sx={{ textAlign: 'center' }}>
                            <EmojiEventsIcon color="primary" fontSize="large" />
                            <Typography variant="h6" fontWeight={600}>{t('challenge.feature3.title')}</Typography>
                            <Typography variant="body2" color="text.secondary">{t('challenge.feature3.desc')}</Typography>
                        </CardContent>
                    </Card>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('challenge.howTitle')}
                </Typography>
                <Stack spacing={1.5} sx={{ mb: 4 }}>
                    {[1, 2, 3, 4].map((n) => (
                        <Stack key={n} direction="row" spacing={2} alignItems="flex-start">
                            <Typography variant="h6" color="primary" sx={{ minWidth: 28, fontWeight: 700 }}>{n}.</Typography>
                            <Typography variant="body1">{t(`challenge.step${n}`)}</Typography>
                        </Stack>
                    ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('challenge.prizesTitle')}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>{t('challenge.prizes')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    {t('challenge.sponsors')}: Craft, Garmin, Sportvorur, Heilsa, Bodylab
                </Typography>

                <Button variant="contained" size="large" sx={{ textTransform: 'none' }}>
                    {t('challenge.register')}
                </Button>
            </Box>
        </Layout>
    );
}

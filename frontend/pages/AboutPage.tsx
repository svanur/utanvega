import { Box, Typography, Paper, Divider, Chip, Stack } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import TimelineIcon from '@mui/icons-material/Timeline';
import PersonIcon from '@mui/icons-material/Person';
import Layout from '../components/Layout';

interface AboutPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

const changelog = [
    { version: '1.5', date: '2025-06', key: 'v1_5' },
    { version: '1.4', date: '2025-05', key: 'v1_4' },
    { version: '1.3', date: '2025-04', key: 'v1_3' },
    { version: '1.2', date: '2025-03', key: 'v1_2' },
    { version: '1.1', date: '2025-02', key: 'v1_1' },
    { version: '1.0', date: '2025-01', key: 'v1_0' },
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
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <PersonIcon color="primary" />
                        <Typography variant="h6" fontWeight="bold">
                            {t('about.authorTitle')}
                        </Typography>
                    </Stack>
                    <Typography variant="body1" color="text.secondary">
                        {t('about.authorDescription')}
                    </Typography>
                    {/* Social links placeholder — uncomment when links are available
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Chip label="Instagram" component="a" href="#" clickable size="small" />
                        <Chip label="Strava" component="a" href="#" clickable size="small" />
                    </Stack>
                    */}
                </Paper>

                <Divider sx={{ mb: 4 }} />

                {/* Timeline */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                    <TimelineIcon color="primary" />
                    <Typography variant="h5" fontWeight="bold">
                        {t('about.changelogTitle')}
                    </Typography>
                </Stack>

                <Stack spacing={2}>
                    {changelog.map((entry) => (
                        <Paper
                            key={entry.key}
                            variant="outlined"
                            sx={{ p: 2, borderRadius: 2, borderLeft: 3, borderLeftColor: 'primary.main' }}
                        >
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                <Chip
                                    label={`v${entry.version}`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                                <Typography variant="caption" color="text.secondary">
                                    {entry.date}
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle2" fontWeight="bold">
                                {t(`about.changelog.${entry.key}.title`)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t(`about.changelog.${entry.key}.description`)}
                            </Typography>
                        </Paper>
                    ))}
                </Stack>
            </Box>
        </Layout>
    );
}

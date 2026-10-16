import { Box, Typography, Paper, Stack, Chip, Link } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import Layout from '../components/Layout';
import MediaSpotifyComponent from '../components/MediaSpotifyComponent';

interface MediaPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

const PODCASTS = [
    { id: 'mothersRunning', episodeId: '0QYEU8rvLYD14lLYzv51lr' },
    { id: 'runningAdventure', episodeId: '1gJfYJp5WDAYELNtCpQwNO' },
];

export default function MediaPage({ mode, onToggleMode }: MediaPageProps) {
    const { t } = useTranslation();
    usePageTitle(t('nav.media'));

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.aboutUs'), to: '/about' }, { label: t('nav.media') }]}>
            <Box sx={{ maxWidth: 720, mx: 'auto' }}>
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
                    {t('media.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('media.description')}
                </Typography>

                <Stack spacing={3}>
                    {/* Spotify podcasts */}
                    {PODCASTS.map((podcast) => (
                        <MediaSpotifyComponent
                            key={podcast.id}
                            episodeId={podcast.episodeId}
                            titleKey={`media.podcasts.${podcast.id}.title`}
                            descriptionKey={`media.podcasts.${podcast.id}.description`}
                        />
                    ))}

                    {/* Newspaper article */}
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <Box
                            component="a"
                            href="/images/hlaupadagskra-bladagrein.avif"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'block' }}
                        >
                            <Box
                                component="img"
                                src="/images/hlaupadagskra-bladagrein.avif"
                                alt={t('media.article.imageAlt')}
                                sx={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'cover', objectPosition: 'top', cursor: 'zoom-in' }}
                            />
                        </Box>
                        <Box sx={{ p: 3 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                <ArticleIcon fontSize="small" color="primary" />
                                <Chip label={t('media.article.source')} size="small" variant="outlined" />
                            </Stack>
                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                                {t('media.article.title')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                {t('media.article.description')}
                            </Typography>
                            <Link
                                href="/images/hlaupadagskra-bladagrein.avif"
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="body2"
                            >
                                {t('media.article.openInNewTab')}
                            </Link>
                        </Box>
                    </Paper>
                </Stack>
            </Box>
        </Layout>
    );
}

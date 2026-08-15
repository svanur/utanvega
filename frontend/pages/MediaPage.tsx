import { Box, Typography, Paper, Stack, Chip, Link } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import Layout from '../components/Layout';

interface MediaPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function MediaPage({ mode, onToggleMode }: MediaPageProps) {
    const { t } = useTranslation();
    usePageTitle(t('nav.media'));

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: 720, mx: 'auto' }}>
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
                    {t('media.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('media.description')}
                </Typography>

                <Stack spacing={3}>
                    {/* Spotify podcast */}
                    <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                            <PodcastsIcon fontSize="small" color="primary" />
                            <Chip label={t('media.podcast.source')} size="small" variant="outlined" />
                        </Stack>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                            {t('media.podcast.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('media.podcast.description')}
                        </Typography>
                        <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <iframe
                                style={{ borderRadius: 12 }}
                                src="https://open.spotify.com/embed/episode/1gJfYJp5WDAYELNtCpQwNO?utm_source=generator"
                                width="100%"
                                height="152"
                                frameBorder="0"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                                title={t('media.podcast.title')}
                            />
                        </Box>
                        <Box sx={{ mt: 1.5 }}>
                            <Link
                                href="https://open.spotify.com/episode/1gJfYJp5WDAYELNtCpQwNO"
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="body2"
                            >
                                {t('media.podcast.openInSpotify')}
                            </Link>
                        </Box>
                    </Paper>

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

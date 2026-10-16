import { Box, Typography, Paper, Stack, Chip, Link } from '@mui/material';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import { useTranslation } from 'react-i18next';

interface MediaSpotifyComponentProps {
    episodeId: string;
    titleKey: string;
    descriptionKey: string;
}

export default function MediaSpotifyComponent({ episodeId, titleKey, descriptionKey }: MediaSpotifyComponentProps) {
    const { t } = useTranslation();

    return (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <PodcastsIcon fontSize="small" color="primary" />
                <Chip label={t('media.podcastSource')} size="small" variant="outlined" />
            </Stack>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                {t(titleKey)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t(descriptionKey)}
            </Typography>
            <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <iframe
                    style={{ borderRadius: 12 }}
                    src={`https://open.spotify.com/embed/episode/${episodeId}?utm_source=generator`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title={t(titleKey)}
                />
            </Box>
            <Box sx={{ mt: 1.5 }}>
                <Link
                    href={`https://open.spotify.com/episode/${episodeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                >
                    {t('media.openInSpotify')}
                </Link>
            </Box>
        </Paper>
    );
}

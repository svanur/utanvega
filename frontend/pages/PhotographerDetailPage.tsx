import { useParams, Link as RouterLink } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    Container,
    Chip,
    Stack,
    PaletteMode,
    Divider,
    Link,
    Card,
    CardActionArea,
    CardContent,
    IconButton,
    Tooltip,
} from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LanguageIcon from '@mui/icons-material/Language';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import HistoryIcon from '@mui/icons-material/History';
import XIcon from '@mui/icons-material/X';
import YouTubeIcon from '@mui/icons-material/YouTube';
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import LostRunner from '../components/LostRunner';
import ShareButtons from '../components/ShareButtons';
import { usePhotographerBySlug, type PhotographerGalleryEntry } from '../hooks/usePhotographers';
import type { PublicPhotoGallery } from '../hooks/useEvents';
import { useLocalize } from '../utils/localize';
import { galleryLabel } from '../utils/galleryLabel';
import { editionKeyFor, formatNextDate } from '../utils/eventUtils';

type PhotographerDetailPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function PhotographerDetailPage({ mode, onToggleMode }: PhotographerDetailPageProps) {
    const { t } = useTranslation();
    const loc = useLocalize();
    const { slug } = useParams<{ slug: string }>();

    const { photographer, loading, error: photographerError } = usePhotographerBySlug(slug);

    // Sorted newest edition first — the backend already orders this way, but render sites
    // shouldn't silently break if that ever changes upstream (mirrors sortedGalleries()).
    const galleries = useMemo<PhotographerGalleryEntry[]>(() => {
        if (!photographer) return [];
        return [...photographer.galleries].sort((a, b) => {
            const dateA = a.editionDate ?? (a.editionYear ? `${a.editionYear}-12-31` : '');
            const dateB = b.editionDate ?? (b.editionYear ? `${b.editionYear}-12-31` : '');
            return dateB.localeCompare(dateA);
        });
    }, [photographer]);

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container maxWidth="md" sx={{ py: 4 }}>
                    <RunningLoader />
                </Container>
            </Layout>
        );
    }

    if (photographerError || !photographer) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container maxWidth="md" sx={{ py: 4 }}>
                    <LostRunner message={t('photographerPage.notFound')} />
                </Container>
            </Layout>
        );
    }

    const description = loc(photographer.description, photographer.descriptionEn);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.events'), to: '/events' }, { label: photographer.name }]}>
            <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                    <Typography variant="h4" component="h1" fontWeight={700}>
                        {photographer.name}
                    </Typography>
                    <ShareButtons title={photographer.name} slug={photographer.slug} />
                </Box>

                {/* Meta row: website + social links */}
                {(photographer.website || (photographer.socialLinks && photographer.socialLinks.length > 0)) && (
                    <Stack direction="row" spacing={3} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
                        {photographer.website && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LanguageIcon fontSize="small" color="action" />
                                <Link
                                    href={photographer.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                    color="primary"
                                    variant="body2"
                                >
                                    {t('photographerPage.website')}
                                </Link>
                            </Box>
                        )}
                        {photographer.socialLinks && photographer.socialLinks.length > 0 && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                {photographer.socialLinks
                                    .filter((link) => /^https?:\/\//i.test(link.url))
                                    .map((link) => {
                                        const type = link.type.toLowerCase();
                                        let icon = <LanguageIcon fontSize="small" />;
                                        if (type === 'facebook') icon = <FacebookIcon fontSize="small" />;
                                        else if (type === 'instagram') icon = <InstagramIcon fontSize="small" />;
                                        else if (type === 'x' || type === 'twitter') icon = <XIcon fontSize="small" />;
                                        else if (type === 'youtube') icon = <YouTubeIcon fontSize="small" />;
                                        else if (type === 'tiktok') icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>;
                                        else if (type === 'strava') icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>;
                                        else if (type === 'vimeo') icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881l-1.924-7.059c-.702-2.587-1.459-3.88-2.26-3.88-.177 0-.795.372-1.854 1.113L0 7.697c1.059-.924 2.101-1.848 3.124-2.772C4.587 3.55 5.697 2.766 6.48 2.766c1.757 0 2.834 1.648 3.236 4.948.435 3.568.74 5.786.905 6.65.504 2.291 1.06 3.435 1.668 3.435.471 0 1.178-.747 2.116-2.241.937-1.494 1.438-2.631 1.498-3.406.131-1.29-.373-1.934-1.498-1.934-.532 0-1.081.122-1.649.365 1.095-3.591 3.187-5.337 6.285-5.239 2.292.066 3.371 1.553 3.236 4.072z"/></svg>;
                                        return (
                                            <Tooltip key={`${type}-${link.url}`} title={link.type}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={link.type}
                                                    onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                                                    sx={{ color: 'text.secondary' }}
                                                >
                                                    {icon}
                                                </IconButton>
                                            </Tooltip>
                                        );
                                    })}
                            </Stack>
                        )}
                    </Stack>
                )}

                {/* Description */}
                {description && (
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 680 }}>
                        {description}
                    </Typography>
                )}

                <Divider sx={{ mb: 3 }} />

                {/* Galleries section */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PhotoCameraIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                        {t('photographerPage.galleries')}
                    </Typography>
                    {galleries.length > 0 && (
                        <Chip label={galleries.length} size="small" color="primary" variant="outlined" />
                    )}
                </Box>

                {galleries.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('photographerPage.noGalleries')}
                    </Typography>
                ) : (
                    <Stack spacing={1.5}>
                        {galleries.map(entry => {
                            const eventName = loc(entry.eventName, entry.eventNameEn);
                            const asPublicGallery: PublicPhotoGallery = {
                                url: entry.galleryUrl,
                                title: entry.galleryTitle,
                                titleEn: entry.galleryTitleEn,
                                photographerName: null,
                                photographerSlug: null,
                                sortOrder: 0,
                            };
                            const label = galleryLabel(asPublicGallery, loc, t);
                            const dateLabel = entry.editionDate
                                ? formatNextDate(entry.editionDate, t)
                                : entry.editionYear
                                    ? String(entry.editionYear)
                                    : null;
                            // The gallery link is the primary, visually dominant action (external, new
                            // tab); the edition link is a secondary affordance back to this site. Kept
                            // as siblings rather than nesting one anchor inside the other's CardActionArea
                            // — nested <a> elements are invalid HTML and break click targeting (see
                            // GalleryCompact.tsx for the same constraint solved the same way).
                            const editionHref = `/events/${entry.eventSlug}/history/${editionKeyFor({ date: entry.editionDate, year: entry.editionYear, id: entry.editionId })}`;
                            return (
                                <Card key={`${entry.editionId}-${entry.galleryUrl}`} variant="outlined" sx={{ borderRadius: 2 }}>
                                    <CardActionArea
                                        component="a"
                                        href={entry.galleryUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={t('photographerPage.openGalleryAriaLabel', { event: eventName })}
                                    >
                                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="body1" fontWeight={600}>
                                                    {eventName}
                                                </Typography>
                                                {dateLabel && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                                        {dateLabel}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                                                <PhotoCameraIcon fontSize="small" color="action" />
                                                <Typography variant="body2" color="text.secondary">
                                                    {label}
                                                </Typography>
                                                <OpenInNewIcon fontSize="small" color="action" sx={{ ml: 'auto' }} />
                                            </Box>
                                        </CardContent>
                                    </CardActionArea>
                                    <Divider />
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, py: 0.75 }}>
                                        <Link
                                            component={RouterLink}
                                            to={editionHref}
                                            variant="body2"
                                            underline="hover"
                                            color="text.secondary"
                                            aria-label={t('photographerPage.viewEditionAriaLabel', { event: eventName })}
                                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                                        >
                                            <HistoryIcon fontSize="inherit" />
                                            {t('photographerPage.viewEdition')}
                                        </Link>
                                    </Box>
                                </Card>
                            );
                        })}
                    </Stack>
                )}
            </Container>
        </Layout>
    );
}

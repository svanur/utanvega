import { useParams } from 'react-router-dom';
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
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LanguageIcon from '@mui/icons-material/Language';
import PersonIcon from '@mui/icons-material/Person';
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import LostRunner from '../components/LostRunner';
import ShareButtons from '../components/ShareButtons';
import { useOrganizerBySlug } from '../hooks/useOrganizers';
import { useEvents } from '../hooks/useEvents';
import { useLocalize } from '../utils/localize';
import { formatDateRange } from '../utils/eventUtils';

type OrganizerDetailPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function OrganizerDetailPage({ mode, onToggleMode }: OrganizerDetailPageProps) {
    const { t } = useTranslation();
    const loc = useLocalize();
    const { slug } = useParams<{ slug: string }>();

    const { organizer, loading: orgLoading, error: orgError } = useOrganizerBySlug(slug);
    const { events, loading: eventsLoading } = useEvents();

    const organizerEvents = useMemo(() => {
        if (!organizer || !events) return [];
        return events
            .filter(e => e.organizerId === organizer.id)
            .sort((a, b) => {
                const dateA = a.displayDate ?? a.nextEditionDate ?? '';
                const dateB = b.displayDate ?? b.nextEditionDate ?? '';
                return dateA.localeCompare(dateB);
            });
    }, [organizer, events]);

    const loading = orgLoading || eventsLoading;

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container maxWidth="md" sx={{ py: 4 }}>
                    <RunningLoader />
                </Container>
            </Layout>
        );
    }

    if (orgError || !organizer) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container maxWidth="md" sx={{ py: 4 }}>
                    <LostRunner message={t('organizerPage.notFound')} />
                </Container>
            </Layout>
        );
    }

    const description = loc(organizer.description, organizer.descriptionEn);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                    <Typography variant="h4" component="h1" fontWeight={700}>
                        {organizer.name}
                    </Typography>
                    <ShareButtons title={organizer.name} slug={organizer.slug} />
                </Box>

                {/* Meta row: website + contact */}
                {(organizer.website || organizer.contactName) && (
                    <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mb: 2 }}>
                        {organizer.website && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LanguageIcon fontSize="small" color="action" />
                                <Link
                                    href={organizer.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                    color="primary"
                                    variant="body2"
                                >
                                    {t('organizerPage.website')}
                                </Link>
                            </Box>
                        )}
                        {organizer.contactName && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PersonIcon fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                    {t('organizerPage.contact')}: {organizer.contactName}
                                </Typography>
                            </Box>
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

                {/* Events section */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <EmojiEventsIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                        {t('organizerPage.events')}
                    </Typography>
                    {organizerEvents.length > 0 && (
                        <Chip label={organizerEvents.length} size="small" color="primary" variant="outlined" />
                    )}
                </Box>

                {organizerEvents.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('organizerPage.noEvents')}
                    </Typography>
                ) : (
                    <Stack spacing={1.5}>
                        {organizerEvents.map(event => {
                            const name = loc(event.name, event.nameEn);
                            const description = loc(event.description, event.descriptionEn);
                            const date = event.displayDate ?? event.nextEditionDate;
                            return (
                                <Card key={event.id} variant="outlined" sx={{ borderRadius: 2 }}>
                                    <CardActionArea component="a" href={`/events/${event.slug}`}>
                                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="body1" fontWeight={600}>
                                                    {name}
                                                </Typography>
                                                {date && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                                        {formatDateRange(date, event.endDisplayDate, t)}
                                                    </Typography>
                                                )}
                                            </Box>
                                            {event.activityType && (
                                                <Chip
                                                    label={t(`eventTypes.${event.activityType}`, { defaultValue: event.activityType })}
                                                    size="small"
                                                    sx={{ mt: 0.5 }}
                                                    variant="outlined"
                                                />
                                            )}
                                            {description && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                                    {description}
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            );
                        })}
                    </Stack>
                )}
            </Container>
        </Layout>
    );
}

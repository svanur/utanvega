import { Box, Chip, Link, Skeleton, Stack, Typography } from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEventDayBanner } from '../hooks/useEventDayBanner';

const MAX_VISIBLE = 4;

export default function EventDayBanner() {
    const { t } = useTranslation();
    const { days, loading } = useEventDayBanner();

    if (loading) {
        return (
            <Box sx={{ mb: 2 }}>
                <Skeleton variant="rounded" height={48} />
            </Box>
        );
    }

    if (days.length === 0) return null;

    return (
        <Box
            sx={{
                mb: 3,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
            }}
        >
            {days.map((day, i) => (
                <Stack
                    key={day.label}
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{
                        px: { xs: 1.5, sm: 2.5 },
                        py: 1.25,
                        borderTop: i > 0 ? '1px solid' : 'none',
                        borderColor: 'divider',
                    }}
                >
                    {/* Day label */}
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: { xs: 72, sm: 100 }, flexShrink: 0 }}>
                        <DirectionsRunIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        <Typography variant="caption" fontWeight={700} color="primary.main" noWrap>
                            {day.label}
                        </Typography>
                    </Stack>

                    {/* Event chips */}
                    <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                        {day.events.slice(0, MAX_VISIBLE).map(event => (
                            <Chip
                                key={event.slug}
                                label={
                                    <span>
                                        {event.name}
                                        {event.locationName && (
                                            <Typography component="span" variant="inherit" sx={{ opacity: 0.6, ml: 0.5 }}>
                                                · {event.locationName}
                                            </Typography>
                                        )}
                                    </span>
                                }
                                component={RouterLink}
                                to={`/events/${event.slug}`}
                                clickable
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                            />
                        ))}
                        {day.overflow > 0 && (
                            <Link
                                component={RouterLink}
                                to="/events"
                                underline="hover"
                                sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}
                            >
                                {t('eventDayBanner.overflow', { count: day.overflow })}
                            </Link>
                        )}
                    </Stack>
                </Stack>
            ))}
        </Box>
    );
}

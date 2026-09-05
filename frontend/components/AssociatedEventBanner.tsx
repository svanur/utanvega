import { Box, Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCountdownLabel } from '../utils/eventUtils';
import { getActivityIcon } from '../utils/getActivityIcon';

interface LinkedRace {
    eventSlug: string;
    eventName: string;
    daysUntil: number | null;
}

interface AssociatedEventBannerProps {
    linkedRaces: LinkedRace[];
    activityType: string;
}

export default function AssociatedEventBanner({ linkedRaces, activityType }: AssociatedEventBannerProps) {
    const { t } = useTranslation();

    const events = Object.values(
        linkedRaces
            .filter(r => r.daysUntil == null || r.daysUntil >= -30)
            .reduce<Record<string, LinkedRace[]>>((acc, r) => {
                (acc[r.eventSlug] ??= []).push(r);
                return acc;
            }, {})
    );

    if (events.length === 0) return null;

    return (
        <Box sx={{ mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
            {events.map((races, i) => {
                const rep = races[0];
                const dayLabel = rep.daysUntil != null ? getCountdownLabel(rep.daysUntil, t) : null;
                return (
                    <Stack
                        key={rep.eventSlug}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: i > 0 ? '1px solid' : 'none', borderColor: 'divider' }}
                    >
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: { xs: 72, sm: 100 }, flexShrink: 0 }}>
                            <Box sx={{ fontSize: 16, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                                {getActivityIcon(activityType)}
                            </Box>
                            <Typography variant="caption" fontWeight={700} color="primary.main" noWrap>
                                {t('trail.associatedEvent')}
                            </Typography>
                        </Stack>
                        <Chip
                            component={RouterLink}
                            to={`/events/${rep.eventSlug}`}
                            clickable
                            label={dayLabel ? `${rep.eventName} · ${dayLabel}` : rep.eventName}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                        />
                    </Stack>
                );
            })}
        </Box>
    );
}

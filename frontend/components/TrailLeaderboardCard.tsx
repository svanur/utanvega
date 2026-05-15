import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { Avatar, Box, Button, Chip, CircularProgress, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { TrailLeaderboardEntry } from '../hooks/useTrails';
import { formatSeconds } from '../utils/timeFormat';
import { getAvatarFallbackText, getAvatarImageSrc } from '../utils/avatarPresets';
import { useAuth } from '../hooks/useAuth';

type TrailLeaderboardCardProps = {
    leaderboard: TrailLeaderboardEntry[];
    totalEntries: number;
    loading: boolean;
    error: string | null;
    trailSlug: string;
};

export default function TrailLeaderboardCard({ leaderboard, totalEntries, loading, error, trailSlug }: TrailLeaderboardCardProps) {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const [expanded, setExpanded] = React.useState(false);
    const topEntry = leaderboard[0];
    const locale = i18n.language === 'is' ? 'is-IS' : 'en-GB';

    const formatLeaderboardDate = (dateIso: string) => {
        try {
            return new Date(`${dateIso}T00:00:00`).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateIso;
        }
    };

    const getBehindTime = (entry: TrailLeaderboardEntry) => {
        if (!topEntry || entry.userId === topEntry.userId) {
            return null;
        }

        const deltaSeconds = Math.max(0, entry.timeInSeconds - topEntry.timeInSeconds);
        return `+${formatSeconds(deltaSeconds)}`;
    };

    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                onClick={() => setExpanded(prev => !prev)}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <EmojiEventsIcon color="warning" />
                    <Typography variant="h6" fontWeight="bold">
                        {t('trail.leaderboardTitle')}
                    </Typography>
                    {!expanded && !loading && topEntry && (
                        <Typography variant="body2" color="text.secondary">
                            #{topEntry.rank} · {topEntry.displayName} · {formatSeconds(topEntry.timeInSeconds)}
                        </Typography>
                    )}
                </Stack>
                <IconButton size="small" sx={{ ml: 0.5 }}>
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            </Stack>

            <Collapse in={expanded}>
                <Box sx={{ mt: 1.5 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {t('trail.leaderboardDescription')}
                    </Typography>
                    {loading ? (
                        <Box display="flex" justifyContent="center" py={1}>
                            <CircularProgress size={20} />
                        </Box>
                    ) : error ? (
                        <Typography variant="body2" color="text.secondary">
                            {t('trail.leaderboardUnavailable')}
                        </Typography>
                    ) : leaderboard.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            {t('trail.leaderboardEmpty')}
                        </Typography>
                    ) : (
                        <Stack spacing={1}>
                            {leaderboard.map(entry => {
                                const behindTime = getBehindTime(entry);
                                const isCurrentUser = user?.id === entry.userId;
                                return (
                                    <Paper
                                        key={entry.userId}
                                        variant="outlined"
                                        sx={{
                                            px: 1.5,
                                            py: 1,
                                            ...(isCurrentUser && {
                                                bgcolor: 'action.selected',
                                                borderColor: 'primary.main',
                                                borderWidth: 2,
                                            }),
                                            ...(entry.rank === 1 && !isCurrentUser && {
                                                bgcolor: 'rgba(255, 193, 7, 0.18)',
                                                borderColor: 'warning.main',
                                            }),
                                            ...(entry.rank === 2 && !isCurrentUser && {
                                                bgcolor: 'rgba(192, 192, 192, 0.22)',
                                            }),
                                            ...(entry.rank === 3 && !isCurrentUser && {
                                                bgcolor: 'rgba(205, 127, 50, 0.18)',
                                            }),
                                        }}
                                    >
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Chip
                                                    size="small"
                                                    label={`#${entry.rank}`}
                                                    color={entry.rank === 1 ? 'warning' : 'default'}
                                                    variant={entry.rank === 1 ? 'filled' : 'outlined'}
                                                />
                                                <Avatar
                                                    src={getAvatarImageSrc(entry.avatarUrl)}
                                                    alt={entry.displayName}
                                                    sx={{ width: 28, height: 28, fontSize: '0.85rem' }}
                                                >
                                                    {getAvatarFallbackText(entry.avatarUrl, entry.displayName.charAt(0).toUpperCase())}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {entry.displayName}
                                                    </Typography>
                                                    {entry.logDate && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatLeaderboardDate(entry.logDate)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Stack>
                                            <Stack alignItems="flex-end" spacing={0.25}>
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {formatSeconds(entry.timeInSeconds)}
                                                </Typography>
                                                {behindTime && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                        {behindTime}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                );
                            })}
                        </Stack>
                    )}
                    {totalEntries > 3 && (
                        <Button
                            component={RouterLink}
                            to={`/trails/${trailSlug}/leaderboard`}
                            variant="text"
                            size="small"
                            sx={{ mt: 1 }}
                        >
                            {t('trail.viewFullLeaderboard')}
                        </Button>
                    )}
                </Box>
            </Collapse>
        </Paper>
    );
}

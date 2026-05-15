import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Container,
    IconButton,
    InputAdornment,
    Paper,
    PaletteMode,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    TextField,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import Layout from '../components/Layout';
import { useTrailBySlug, useTrailLeaderboard } from '../hooks/useTrails';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../hooks/useAuth';
import { formatSeconds } from '../utils/timeFormat';
import { getAvatarFallbackText, getAvatarImageSrc } from '../utils/avatarPresets';

type Props = { mode: PaletteMode; onToggleMode: () => void };
type SortKey = 'rank' | 'runner' | 'time' | 'behind' | 'date';

export default function TrailLeaderboardPage({ mode, onToggleMode }: Props) {
    const { slug } = useParams<{ slug: string }>();
    const { t, i18n } = useTranslation();
    const { isEnabled } = useFeatureFlags();
    const { user } = useAuth();
    const locale = i18n.language === 'is' ? 'is-IS' : 'en-GB';
    const { trail, loading: trailLoading } = useTrailBySlug(slug);
    const { leaderboard, loading: leaderboardLoading, error } = useTrailLeaderboard(slug, 1000, true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('rank');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const topTime = leaderboard[0]?.timeInSeconds ?? 0;

    const formatLeaderboardDate = (dateIso?: string) => {
        if (!dateIso) return '-';
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

    const visibleEntries = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const filtered = query
            ? leaderboard.filter(entry =>
                entry.displayName.toLowerCase().includes(query)
                || entry.userId.toLowerCase().includes(query))
            : leaderboard;

        const sorted = [...filtered];
        const dir = sortDirection === 'asc' ? 1 : -1;

        sorted.sort((a, b) => {
            switch (sortBy) {
                case 'rank':
                    return (a.rank - b.rank) * dir;
                case 'runner':
                    return a.displayName.localeCompare(b.displayName) * dir;
                case 'time':
                    return (a.timeInSeconds - b.timeInSeconds) * dir;
                case 'behind': {
                    const behindA = Math.max(0, a.timeInSeconds - topTime);
                    const behindB = Math.max(0, b.timeInSeconds - topTime);
                    return (behindA - behindB) * dir;
                }
                case 'date':
                    return (a.logDate ?? '').localeCompare(b.logDate ?? '') * dir;
                default:
                    return 0;
            }
        });

        return sorted;
    }, [leaderboard, searchQuery, sortBy, sortDirection, topTime]);

    const handleSort = (key: SortKey) => {
        if (sortBy === key) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(key);
        setSortDirection(key === 'runner' ? 'asc' : 'desc');
    };

    if (!slug) {
        return <Navigate to="/" replace />;
    }

    if (!isEnabled('trail_leaderboard', false)) {
        return <Navigate to={`/trails/${slug}`} replace />;
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={() => window.history.back()} sx={{ mb: 2 }}>
                    {t('trail.backToTrails')}
                </Button>

                <Paper elevation={3} sx={{ p: 3 }}>
                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                        {trail?.name
                            ? t('trail.leaderboardForTrail', { trailName: trail.name })
                            : t('trail.leaderboardTitle')}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        {t('trail.leaderboardDescription')}
                    </Typography>

                    <TextField
                        size="small"
                        fullWidth
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('trail.leaderboardSearchPlaceholder')}
                        sx={{ mb: 2 }}
                        InputProps={{
                            endAdornment: searchQuery ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => setSearchQuery('')}
                                        aria-label={t('common.clear', 'Clear search')}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : undefined,
                        }}
                    />

                    {trailLoading || leaderboardLoading ? (
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                            <CircularProgress size={20} />
                            <Typography color="text.secondary">{t('loading')}</Typography>
                        </Stack>
                    ) : error ? (
                        <Typography color="text.secondary">{t('trail.leaderboardUnavailable')}</Typography>
                    ) : visibleEntries.length === 0 ? (
                        <Typography color="text.secondary">{t('trail.leaderboardEmpty')}</Typography>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortBy === 'rank'}
                                                direction={sortBy === 'rank' ? sortDirection : 'asc'}
                                                onClick={() => handleSort('rank')}
                                            >
                                                {t('trail.leaderboardRank')}
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortBy === 'runner'}
                                                direction={sortBy === 'runner' ? sortDirection : 'asc'}
                                                onClick={() => handleSort('runner')}
                                            >
                                                {t('trail.leaderboardRunner')}
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell align="right">
                                            <TableSortLabel
                                                active={sortBy === 'time'}
                                                direction={sortBy === 'time' ? sortDirection : 'asc'}
                                                onClick={() => handleSort('time')}
                                            >
                                                {t('trail.leaderboardTime')}
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell align="right">
                                            <TableSortLabel
                                                active={sortBy === 'behind'}
                                                direction={sortBy === 'behind' ? sortDirection : 'asc'}
                                                onClick={() => handleSort('behind')}
                                            >
                                                {t('trail.leaderboardBehind')}
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell align="right">
                                            <TableSortLabel
                                                active={sortBy === 'date'}
                                                direction={sortBy === 'date' ? sortDirection : 'asc'}
                                                onClick={() => handleSort('date')}
                                            >
                                                {t('trail.leaderboardDate')}
                                            </TableSortLabel>
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {visibleEntries.map(entry => {
                                        const behind = entry.rank === 1 ? '-' : `+${formatSeconds(Math.max(0, entry.timeInSeconds - topTime))}`;
                                        const isCurrentUser = user?.id === entry.userId;
                                        return (
                                            <TableRow key={entry.userId} sx={{
                                                ...(isCurrentUser && {
                                                    bgcolor: 'action.selected',
                                                    '&:hover': {
                                                        bgcolor: 'action.hover',
                                                    }
                                                })
                                            }}>
                                                <TableCell>#{entry.rank}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Avatar src={getAvatarImageSrc(entry.avatarUrl)} alt={entry.displayName} sx={{ width: 26, height: 26, fontSize: '0.8rem' }}>
                                                            {getAvatarFallbackText(entry.avatarUrl, entry.displayName.charAt(0).toUpperCase())}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={600}>
                                                                {entry.displayName}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                                                    {formatSeconds(entry.timeInSeconds)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                                                    {behind}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {formatLeaderboardDate(entry.logDate)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            </Container>
        </Layout>
    );
}

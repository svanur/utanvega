import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Container,
    Typography,
    Box,
    Paper,
    IconButton,
    Stack,
    Chip,
    alpha,
    useTheme,
    PaletteMode,
    Popover,
    List,
    ListItemButton,
    ListItemText,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import { useCompetitionCalendar, CalendarDay } from '../hooks/useCompetitions';
import { useNavigate } from 'react-router-dom';

type RaceCalendarPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

function getMonthRange(year: number, month: number): { from: string; to: string } {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
}

export default function RaceCalendarPage({ mode, onToggleMode }: RaceCalendarPageProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const today = new Date();

    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());

    const { from, to } = useMemo(() => getMonthRange(year, month), [year, month]);
    const { days, loading } = useCompetitionCalendar(from, to);

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const [todayFlash, setTodayFlash] = useState(false);
    const todayRef = useRef<HTMLDivElement>(null);

    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const weekdays = t('races.weekdays', { returnObjects: true }) as unknown as string[];
    const shortWeekdays = weekdays.map(d => d.slice(0, 3));

    const eventsByDate = useMemo(() => {
        const map = new Map<number, CalendarDay>();
        for (const day of days) {
            const d = new Date(day.date + 'T00:00:00');
            map.set(d.getDate(), day);
        }
        return map;
    }, [days]);

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // Monday = 0 in our grid
    const startOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarCells = useMemo(() => {
        const cells: (number | null)[] = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        // Pad to complete last row
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [startOffset, daysInMonth]);

    const isToday = (day: number) =>
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    const goToToday = () => {
        setYear(today.getFullYear());
        setMonth(today.getMonth());
        // Flash the today cell
        setTodayFlash(true);
        setTimeout(() => {
            todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTodayFlash(false);
        }, 150);
    };

    const prevMonth = () => {
        if (month === 0) { setMonth(11); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };

    const nextMonth = () => {
        if (month === 11) { setMonth(0); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };

    const handleDayClick = (day: number, event: React.MouseEvent<HTMLElement>) => {
        const dayData = eventsByDate.get(day);
        if (!dayData) return;
        setSelectedDay(dayData);
        setAnchorEl(event.currentTarget);
    };

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="sm" sx={{ py: 3 }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <IconButton onClick={() => navigate('/races')} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                    <EmojiEventsIcon sx={{ color: theme.palette.warning.main }} />
                    <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
                        {t('calendar.title')}
                    </Typography>
                    <Chip
                        icon={<TodayIcon />}
                        label={t('calendar.today')}
                        size="small"
                        variant="outlined"
                        onClick={goToToday}
                    />
                </Stack>

                {/* Month navigation */}
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 2 }}>
                    <IconButton onClick={prevMonth} size="small"><ChevronLeftIcon /></IconButton>
                    <Typography variant="h6" fontWeight={600} sx={{ minWidth: 180, textAlign: 'center' }}>
                        {months[month]} {year}
                    </Typography>
                    <IconButton onClick={nextMonth} size="small"><ChevronRightIcon /></IconButton>
                </Stack>

                {loading && <RunningLoader />}

                {/* Calendar grid */}
                {!loading && (
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        {/* Weekday headers */}
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            bgcolor: 'action.hover',
                        }}>
                            {shortWeekdays.map((wd, i) => (
                                <Box key={i} sx={{ py: 1, textAlign: 'center' }}>
                                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                                        {/* Show Mon-Sun starting from Monday */}
                                        {shortWeekdays[(i + 1) % 7]}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>

                        {/* Day cells */}
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                        }}>
                            {calendarCells.map((day, i) => {
                                const hasEvents = day !== null && eventsByDate.has(day);
                                const todayCell = day !== null && isToday(day);
                                const eventCount = hasEvents ? eventsByDate.get(day)!.events.length : 0;

                                return (
                                    <Box
                                        key={i}
                                        ref={todayCell ? todayRef : undefined}
                                        onClick={(e) => day !== null && hasEvents && handleDayClick(day, e)}
                                        sx={{
                                            position: 'relative',
                                            minHeight: { xs: 48, sm: 64 },
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderTop: '1px solid',
                                            borderColor: 'divider',
                                            cursor: hasEvents ? 'pointer' : 'default',
                                            transition: 'background-color 0.3s',
                                            ...(hasEvents && {
                                                bgcolor: alpha(theme.palette.success.main, 0.08),
                                                '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.18) },
                                            }),
                                            ...(todayCell && {
                                                bgcolor: todayFlash
                                                    ? alpha(theme.palette.primary.main, 0.35)
                                                    : alpha(theme.palette.primary.main, 0.12),
                                                '&:hover': hasEvents
                                                    ? { bgcolor: alpha(theme.palette.success.main, 0.22) }
                                                    : undefined,
                                            }),
                                        }}
                                    >
                                        {day !== null && (
                                            <>
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={todayCell ? 800 : hasEvents ? 600 : 400}
                                                    color={todayCell ? 'primary' : hasEvents ? 'text.primary' : 'text.secondary'}
                                                >
                                                    {day}
                                                </Typography>
                                                {hasEvents && (
                                                    <Stack direction="row" spacing={0.3} sx={{ mt: 0.3 }}>
                                                        {Array.from({ length: Math.min(eventCount, 3) }).map((_, j) => (
                                                            <Box
                                                                key={j}
                                                                sx={{
                                                                    width: 6,
                                                                    height: 6,
                                                                    borderRadius: '50%',
                                                                    bgcolor: 'success.main',
                                                                }}
                                                            />
                                                        ))}
                                                        {eventCount > 3 && (
                                                            <Typography variant="caption" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>
                                                                +{eventCount - 3}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                )}
                                            </>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                )}

                {/* Event count summary */}
                {!loading && days.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                        {t('calendar.eventCount', { count: days.reduce((sum, d) => sum + d.events.length, 0) })}
                    </Typography>
                )}

                {/* Popover for clicked day */}
                <Popover
                    open={Boolean(anchorEl) && Boolean(selectedDay)}
                    anchorEl={anchorEl}
                    onClose={() => { setAnchorEl(null); setSelectedDay(null); }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                    slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 240, maxWidth: 320 } } }}
                >
                    {selectedDay && (
                        <Box sx={{ p: 1 }}>
                            <Typography variant="subtitle2" sx={{ px: 1, pt: 0.5 }}>
                                {new Date(selectedDay.date + 'T00:00:00').getDate()}. {months[month]}
                            </Typography>
                            <List dense disablePadding>
                                {selectedDay.events.map((ev, i) => (
                                    <ListItemButton
                                        key={i}
                                        onClick={() => navigate(`/races/${ev.slug}`)}
                                        sx={{ borderRadius: 1 }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <EmojiEventsIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                                    <Typography variant="body2" fontWeight={600}>{ev.name}</Typography>
                                                </Stack>
                                            }
                                            secondary={
                                                ev.locationName && (
                                                    <Stack direction="row" alignItems="center" spacing={0.3} sx={{ mt: 0.3 }}>
                                                        <LocationOnIcon sx={{ fontSize: 12 }} />
                                                        <Typography variant="caption">{ev.locationName}</Typography>
                                                    </Stack>
                                                )
                                            }
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>
                    )}
                </Popover>
            </Container>
        </Layout>
    );
}

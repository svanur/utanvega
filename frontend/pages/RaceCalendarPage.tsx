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
    Snackbar,
    Alert,
    Tooltip,
    ToggleButtonGroup,
    ToggleButton,
    Divider,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ViewListIcon from '@mui/icons-material/ViewList';
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import { useEventCalendar, CalendarDay, CalendarEvent } from '../hooks/useEvents';
import { useLocalize } from '../utils/localize';
import { ActivityIcons } from '../utils/activityIcon';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../hooks/useTrails';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useIcelandicHolidays } from '../hooks/useIcelandicHolidays';

type RaceCalendarPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

type CalendarView = 'month' | 'schedule';

function getMonthRange(year: number, month: number): { from: string; to: string } {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
}

function getScheduleRange(today: Date): { from: string; to: string } {
    const from = today.toISOString().slice(0, 10);
    const to3m = new Date(today);
    to3m.setMonth(to3m.getMonth() + 3);
    return { from, to: to3m.toISOString().slice(0, 10) };
}

// ── Schedule view ─────────────────────────────────────────────────────────────

interface ScheduleViewProps {
    days: CalendarDay[];
    loading: boolean;
    today: Date;
    onEventClick: (slug: string) => void;
    loc: (is: string, en: string | null) => string | null;
    t: (key: string, opts?: object) => string;
}

function ScheduleView({ days, loading, today, onEventClick, loc, t }: ScheduleViewProps) {
    const theme = useTheme();
    const todayStr = today.toISOString().slice(0, 10);

    const weekdayShort = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('is-IS', { weekday: 'short' });
    };

    const monthShort = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('is-IS', { month: 'short' });
    };

    // Group consecutive empty weeks to show a quiet divider
    type Group =
        | { kind: 'day'; day: CalendarDay }
        | { kind: 'gap'; label: string };

    const groups = useMemo((): Group[] => {
        if (!days.length) return [];
        const result: Group[] = [];
        let prev: Date | null = null;
        for (const day of days) {
            const cur = new Date(day.date + 'T00:00:00');
            if (prev) {
                const gapDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
                if (gapDays >= 7) {
                    result.push({ kind: 'gap', label: t('calendar.quietWeek', { defaultValue: 'No events' }) });
                }
            }
            result.push({ kind: 'day', day });
            prev = cur;
        }
        return result;
    }, [days, t]);

    if (loading) return <RunningLoader />;

    if (!days.length) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
                {t('calendar.noEvents')}
            </Typography>
        );
    }

    return (
        <Stack spacing={0} divider={<Divider />}>
            {groups.map((g, gi) => {
                if (g.kind === 'gap') {
                    return (
                        <Box key={`gap-${gi}`} sx={{ py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                                {g.label}
                            </Typography>
                            <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                        </Box>
                    );
                }

                const { day } = g;
                const isToday = day.date === todayStr;
                const d = new Date(day.date + 'T00:00:00');
                const dayNum = d.getDate();

                return (
                    <Box key={day.date} sx={{ display: 'flex', gap: 2, py: 2 }}>
                        {/* Date column */}
                        <Box sx={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                            minWidth: 44, flexShrink: 0, pt: '2px',
                        }}>
                            <Typography
                                variant="h5"
                                fontWeight={500}
                                lineHeight={1}
                                color={isToday ? 'primary' : 'text.primary'}
                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                                {dayNum}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: '.04em', mt: '2px', textAlign: 'right' }}>
                                {weekdayShort(day.date)}<br />{monthShort(day.date)}
                            </Typography>
                            {isToday && (
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', mt: '4px' }} />
                            )}
                        </Box>

                        {/* Events column */}
                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                            {day.events.map((ev: CalendarEvent, ei: number) => (
                                <Paper
                                    key={ev.raceName ? `${ev.slug}-${ev.raceName}` : ev.slug}
                                    variant="outlined"
                                    onClick={() => onEventClick(ev.slug)}
                                    sx={{
                                        px: 1.5, py: 1,
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.25) },
                                    }}
                                >
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
                                            sx={{ mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        >
                                            {loc(ev.name, ev.nameEn) ?? ev.name}
                                            {ev.raceName && (
                                                <Typography component="span" variant="body2" color="text.secondary" fontWeight={400}>
                                                    {' · '}{ev.raceName}
                                                </Typography>
                                            )}
                                        </Typography>
                                        <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                                            {ev.activityTypes && ev.activityTypes.length > 0 && (
                                                <ActivityIcons activityTypes={ev.activityTypes} activityType={ev.activityTypes[0]} />
                                            )}
                                            {ev.editionTitle && (
                                                <Typography variant="caption" color="text.secondary">{ev.editionTitle}</Typography>
                                            )}
                                            {ev.locationName && (
                                                <Stack direction="row" alignItems="center" spacing={0.25}>
                                                    <LocationOnIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                                                    <Typography variant="caption" color="text.disabled">{ev.locationName}</Typography>
                                                </Stack>
                                            )}
                                            {ev.distances && ev.distances.length > 0
                                                ? ev.distances.map((d, i) => (
                                                    <Chip
                                                        key={i}
                                                        label={d}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                                                    />
                                                ))
                                                : ev.raceCount > 1 && (
                                                    <Chip
                                                        label={`${ev.raceCount} ${ev.raceCount === 1 ? t('calendar.race', { defaultValue: 'race' }) : t('calendar.racesPlural', { defaultValue: 'races' })}`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                                                    />
                                                )
                                            }
                                        </Stack>
                                    </Box>
                                </Paper>
                            ))}
                        </Stack>
                    </Box>
                );
            })}
        </Stack>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RaceCalendarPage({ mode, onToggleMode }: RaceCalendarPageProps) {
    const { t } = useTranslation();
    const loc = useLocalize();
    const theme = useTheme();
    const navigate = useNavigate();
    const params = useParams<{ year?: string; month?: string }>();
    const { isEnabled } = useFeatureFlags();
    const today = new Date();

    const [view, setView] = useState<CalendarView>(() => {
        try { return (localStorage.getItem('calendarView') as CalendarView) ?? 'month'; }
        catch { return 'month'; }
    });

    const handleViewChange = (_: React.MouseEvent, v: CalendarView | null) => {
        if (!v) return;
        setView(v);
        try { localStorage.setItem('calendarView', v); } catch { /* ignore */ }
    };

    const year = params.year ? parseInt(params.year, 10) : today.getFullYear();
    const month = params.month ? parseInt(params.month, 10) - 1 : today.getMonth();

    const navigateToMonth = (y: number, m: number) => {
        navigate(`/events/calendar/${y}/${String(m + 1).padStart(2, '0')}`);
    };

    // Month view data
    const { from: monthFrom, to: monthTo } = useMemo(() => getMonthRange(year, month), [year, month]);
    const { days: monthDays, loading: monthLoading } = useEventCalendar(monthFrom, monthTo, view === 'month');

    // Schedule view data — rolling 3 months from today
    const { from: schedFrom, to: schedTo } = useMemo(() => getScheduleRange(today), []);
    const { days: schedDays, loading: schedLoading } = useEventCalendar(schedFrom, schedTo, view === 'schedule');

    const { getHolidays } = useIcelandicHolidays();

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const [todayFlash, setTodayFlash] = useState(false);
    const [subscribeSnackbar, setSubscribeSnackbar] = useState('');
    const todayRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);

    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const weekdays = t('races.weekdays', { returnObjects: true }) as unknown as string[];
    const shortWeekdays = weekdays.map(d => d.slice(0, 3));

    const eventsByDate = useMemo(() => {
        const map = new Map<number, CalendarDay>();
        for (const day of monthDays) {
            const d = new Date(day.date + 'T00:00:00');
            map.set(d.getDate(), day);
        }
        return map;
    }, [monthDays]);

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarCells = useMemo(() => {
        const cells: (number | null)[] = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [startOffset, daysInMonth]);

    const isToday = (day: number) =>
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    const goToToday = () => {
        navigateToMonth(today.getFullYear(), today.getMonth());
        setTodayFlash(true);
        setTimeout(() => {
            todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTodayFlash(false);
        }, 150);
    };

    const prevMonth = () => { if (month === 0) navigateToMonth(year - 1, 11); else navigateToMonth(year, month - 1); };
    const nextMonth = () => { if (month === 11) navigateToMonth(year + 1, 0); else navigateToMonth(year, month + 1); };

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
                    <IconButton onClick={() => navigate('/events')} sx={{ minWidth: 44, minHeight: 44 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <EmojiEventsIcon sx={{ color: theme.palette.warning.main }} />
                    <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
                        {t('calendar.title')}
                    </Typography>
                    {view === 'month' && (
                        <Chip
                            icon={<TodayIcon />}
                            label={t('calendar.today')}
                            size="small"
                            variant="outlined"
                            onClick={goToToday}
                        />
                    )}
                    {isEnabled('calendar_integration', false) && (
                        <Tooltip title={t('calendar.subscribeTooltip', { defaultValue: 'Subscribe to live calendar feed' })}>
                            <Chip
                                icon={<CalendarMonthIcon />}
                                label={t('calendar.subscribe', { defaultValue: 'Subscribe' })}
                                size="small"
                                color="primary"
                                variant="outlined"
                                onClick={() => {
                                    const icsUrl = `${API_URL}/api/v1/events/calendar.ics`;
                                    const webcalUrl = icsUrl.replace(/^https?:/, 'webcal:');
                                    if (!navigator.clipboard) { window.location.href = webcalUrl; return; }
                                    navigator.clipboard.writeText(icsUrl)
                                        .then(() => setSubscribeSnackbar(t('calendar.subscribeSuccess', { defaultValue: 'Calendar URL copied! Paste it in your calendar app.' })))
                                        .catch(() => { window.location.href = webcalUrl; });
                                }}
                            />
                        </Tooltip>
                    )}
                </Stack>

                {/* View toggle + month nav */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    {view === 'month' ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <IconButton onClick={prevMonth} size="small"><ChevronLeftIcon /></IconButton>
                            <Typography variant="h6" fontWeight={600} sx={{ minWidth: { xs: 130, sm: 170 }, textAlign: 'center' }}>
                                {months[month]} {year}
                            </Typography>
                            <IconButton onClick={nextMonth} size="small"><ChevronRightIcon /></IconButton>
                        </Stack>
                    ) : (
                        <Typography variant="h6" fontWeight={600}>
                            {t('calendar.upcoming', { defaultValue: 'Upcoming' })}
                        </Typography>
                    )}

                    <ToggleButtonGroup
                        value={view}
                        exclusive
                        onChange={handleViewChange}
                        size="small"
                        aria-label={t('calendar.viewToggle', { defaultValue: 'Calendar view' })}
                    >
                        <ToggleButton value="month" aria-label={t('calendar.monthView', { defaultValue: 'Month' })}>
                            <Tooltip title={t('calendar.monthView', { defaultValue: 'Month' })}>
                                <CalendarMonthIcon fontSize="small" />
                            </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="schedule" aria-label={t('calendar.scheduleView', { defaultValue: 'Schedule' })}>
                            <Tooltip title={t('calendar.scheduleView', { defaultValue: 'Schedule' })}>
                                <ViewListIcon fontSize="small" />
                            </Tooltip>
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>

                {/* ── Month view ── */}
                {view === 'month' && (
                    <>
                        {monthLoading && <RunningLoader />}
                        {!monthLoading && (
                            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}
                                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                                onTouchEnd={(e) => {
                                    if (touchStartX.current === null) return;
                                    const diff = e.changedTouches[0].clientX - touchStartX.current;
                                    touchStartX.current = null;
                                    if (Math.abs(diff) > 60) { if (diff > 0) prevMonth(); else nextMonth(); }
                                }}
                            >
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', bgcolor: 'action.hover' }}>
                                    {shortWeekdays.map((wd, i) => (
                                        <Box key={i} sx={{ py: 1, textAlign: 'center' }}>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                                                {shortWeekdays[(i + 1) % 7]}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                                    {calendarCells.map((day, i) => {
                                        const hasEvents = day !== null && eventsByDate.has(day);
                                        const todayCell = day !== null && isToday(day);
                                        const eventCount = hasEvents ? eventsByDate.get(day)!.events.length : 0;
                                        const colIndex = i % 7;
                                        const isWeekendCol = colIndex === 5 || colIndex === 6;
                                        const dateStr = day !== null
                                            ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                            : null;
                                        const holidays = dateStr ? getHolidays(dateStr) : [];
                                        const isHoliday = holidays.length > 0;

                                        return (
                                            <Tooltip
                                                key={i}
                                                title={isHoliday ? holidays.map(h => loc(h.name, h.nameEn) ?? h.name).join(' · ') : ''}
                                                arrow
                                                disableHoverListener={!isHoliday}
                                            >
                                                <Box
                                                    ref={todayCell ? todayRef : undefined}
                                                    role={hasEvents ? 'button' : undefined}
                                                    tabIndex={hasEvents ? 0 : undefined}
                                                    onClick={(e) => day !== null && hasEvents && handleDayClick(day, e)}
                                                    onKeyDown={(e) => {
                                                        if (hasEvents && day !== null && (e.key === 'Enter' || e.key === ' ')) {
                                                            e.preventDefault();
                                                            handleDayClick(day, e as unknown as React.MouseEvent<HTMLElement>);
                                                        }
                                                    }}
                                                    aria-label={day !== null ? (hasEvents
                                                        ? `${day}. ${months[month]}, ${eventCount} ${eventCount === 1 ? 'event' : 'events'}`
                                                        : `${day}. ${months[month]}`) : undefined}
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
                                                        ...(isWeekendCol && day !== null && !todayCell && { bgcolor: alpha(theme.palette.action.hover, 0.15) }),
                                                        ...(isHoliday && !todayCell && { bgcolor: alpha(theme.palette.warning.main, 0.08) }),
                                                        ...(hasEvents && { bgcolor: alpha(theme.palette.success.main, 0.08), '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.18) } }),
                                                        ...(todayCell && {
                                                            bgcolor: todayFlash ? alpha(theme.palette.primary.main, 0.35) : alpha(theme.palette.primary.main, 0.12),
                                                            '&:hover': hasEvents ? { bgcolor: alpha(theme.palette.success.main, 0.22) } : undefined,
                                                        }),
                                                    }}
                                                >
                                                    {day !== null && (
                                                        <>
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight={todayCell ? 800 : hasEvents ? 600 : 400}
                                                                color={todayCell ? 'primary' : isWeekendCol ? 'text.secondary' : hasEvents ? 'text.primary' : 'text.secondary'}
                                                            >
                                                                {day}
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.3} sx={{ mt: 0.3 }}>
                                                                {isHoliday && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} />}
                                                                {hasEvents && Array.from({ length: Math.min(eventCount, 3) }).map((_, j) => (
                                                                    <Box key={j} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
                                                                ))}
                                                                {hasEvents && eventCount > 3 && (
                                                                    <Typography variant="caption" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>+{eventCount - 3}</Typography>
                                                                )}
                                                            </Stack>
                                                        </>
                                                    )}
                                                </Box>
                                            </Tooltip>
                                        );
                                    })}
                                </Box>
                            </Paper>
                        )}
                        {!monthLoading && monthDays.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                                {t('calendar.eventCount', { count: new Set(monthDays.flatMap(d => d.events.map(e => e.slug))).size })}
                            </Typography>
                        )}
                        {!monthLoading && monthDays.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                                {t('calendar.noEvents')}
                            </Typography>
                        )}
                    </>
                )}

                {/* ── Schedule view ── */}
                {view === 'schedule' && (
                    <ScheduleView
                        days={schedDays}
                        loading={schedLoading}
                        today={today}
                        onEventClick={(slug) => navigate(`/events/${slug}`)}
                        loc={loc}
                        t={t}
                    />
                )}

                {/* Day popover (month view) */}
                <Popover
                    open={Boolean(anchorEl) && Boolean(selectedDay)}
                    anchorEl={anchorEl}
                    onClose={() => { setAnchorEl(null); setSelectedDay(null); }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                    slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 240, maxWidth: 320 } } }}
                >
                    {selectedDay && (() => {
                        const popoverHolidays = getHolidays(selectedDay.date);
                        return (
                            <Box sx={{ p: 1 }}>
                                <Typography variant="subtitle2" sx={{ px: 1, pt: 0.5 }}>
                                    {new Date(selectedDay.date + 'T00:00:00').getDate()}. {months[month]}
                                </Typography>
                                {popoverHolidays.length > 0 && (
                                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ px: 1, pb: 0.5 }}>
                                        {popoverHolidays.map((h, i) => (
                                            <Chip key={i} label={loc(h.name, h.nameEn) ?? h.name} size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
                                        ))}
                                    </Stack>
                                )}
                                <List dense disablePadding>
                                    {selectedDay.events.map((ev, i) => (
                                        <ListItemButton key={i} onClick={() => navigate(`/events/${ev.slug}`)} sx={{ borderRadius: 1 }}>
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                                        {ev.activityTypes && ev.activityTypes.length > 0
                                                            ? <ActivityIcons activityTypes={ev.activityTypes} activityType={ev.activityTypes[0]} />
                                                            : <EmojiEventsIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                                        }
                                                        <Typography variant="body2" fontWeight={600}>{loc(ev.name, ev.nameEn) ?? ev.name}</Typography>
                                                    </Stack>
                                                }
                                                secondary={
                                                    (ev.editionTitle || ev.locationName) && (
                                                        <Stack spacing={0.3} sx={{ mt: 0.3 }}>
                                                            {ev.editionTitle && <Typography variant="caption" color="text.secondary">{ev.editionTitle}</Typography>}
                                                            {ev.locationName && (
                                                                <Stack direction="row" alignItems="center" spacing={0.3}>
                                                                    <LocationOnIcon sx={{ fontSize: 12 }} />
                                                                    <Typography variant="caption">{ev.locationName}</Typography>
                                                                </Stack>
                                                            )}
                                                        </Stack>
                                                    )
                                                }
                                            />
                                        </ListItemButton>
                                    ))}
                                </List>
                            </Box>
                        );
                    })()}
                </Popover>

                <Snackbar
                    open={!!subscribeSnackbar}
                    autoHideDuration={5000}
                    onClose={() => setSubscribeSnackbar('')}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity="success" onClose={() => setSubscribeSnackbar('')} variant="filled">
                        {subscribeSnackbar}
                    </Alert>
                </Snackbar>
            </Container>
        </Layout>
    );
}

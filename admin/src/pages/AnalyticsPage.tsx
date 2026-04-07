import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Grid, Skeleton, Chip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Stack
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RouteIcon from '@mui/icons-material/Route';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, Area, AreaChart, Line
} from 'recharts';
import { apiFetch } from '../hooks/api';

interface Summary {
    totalViews: number;
    uniqueVisitors: number;
    viewsThisWeek: number;
    viewsLastWeek: number;
    avgViewsPerTrail: number;
    trailsWithViews: number;
}

interface DailyViews {
    date: string;
    views: number;
    uniqueVisitors: number;
}

interface HourlyViews {
    hour: number;
    views: number;
}

interface TopTrail {
    name: string;
    slug: string;
    viewCount: number;
    uniqueVisitors: number;
}

interface TrendingTrail {
    name: string;
    slug: string;
    viewsThisWeek: number;
    viewsLastWeek: number;
    changePercent: number;
}

interface AnalyticsData {
    summary: Summary;
    dailyViews: DailyViews[];
    hourlyViews: HourlyViews[];
    topTrails: TopTrail[];
    trendingTrails: TrendingTrail[];
}

function StatCard({ title, value, subtitle, icon, color }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
}) {
    return (
        <Paper elevation={2} sx={{ p: 2.5, height: '100%' }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        {title}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
                        {value}
                    </Typography>
                    {subtitle && (
                        <Typography variant="caption" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </Box>
                <Box sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: `${color}15`,
                    color: color,
                    display: 'flex',
                }}>
                    {icon}
                </Box>
            </Stack>
        </Paper>
    );
}

function WeekChangeChip({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
    if (lastWeek === 0 && thisWeek === 0) return <Chip label="—" size="small" variant="outlined" />;
    if (lastWeek === 0) return <Chip label="New" size="small" color="info" />;
    const change = ((thisWeek - lastWeek) / lastWeek) * 100;
    const isUp = change >= 0;
    return (
        <Chip
            icon={isUp ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={`${isUp ? '+' : ''}${change.toFixed(0)}%`}
            size="small"
            color={isUp ? 'success' : 'error'}
            variant="outlined"
        />
    );
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
    `${i.toString().padStart(2, '0')}:00`
);

const COLORS = ['#2e7d32', '#43a047', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9', '#e8f5e9', '#f1f8e9', '#f9fbe7', '#fffde7'];

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<AnalyticsData>('/api/v1/admin/analytics')
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <Box>
                <Typography variant="h5" fontWeight="bold" mb={3}>Analytics</Typography>
                <Grid container spacing={2} mb={3}>
                    {[1, 2, 3, 4].map(i => (
                        <Grid item xs={6} md={3} key={i}>
                            <Skeleton variant="rounded" height={100} />
                        </Grid>
                    ))}
                </Grid>
                <Skeleton variant="rounded" height={300} sx={{ mb: 3 }} />
                <Skeleton variant="rounded" height={300} />
            </Box>
        );
    }

    if (error || !data) {
        return (
            <Box>
                <Typography variant="h5" fontWeight="bold" mb={2}>Analytics</Typography>
                <Typography color="error">Failed to load analytics: {error}</Typography>
            </Box>
        );
    }

    const { summary, dailyViews, hourlyViews, topTrails, trendingTrails } = data;

    // Fill in missing days in dailyViews for a continuous chart
    const filledDailyViews = (() => {
        const map = new Map(dailyViews.map(d => [d.date, d]));
        const result: DailyViews[] = [];
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().split('T')[0];
            result.push(map.get(key) || { date: key, views: 0, uniqueVisitors: 0 });
        }
        return result;
    })();

    // Fill in missing hours
    const filledHourlyViews = Array.from({ length: 24 }, (_, h) => {
        const found = hourlyViews.find(hv => hv.hour === h);
        return { hour: h, views: found?.views || 0, label: HOUR_LABELS[h] };
    });
    const maxHourlyViews = Math.max(...filledHourlyViews.map(h => h.views), 1);

    const weekChange = summary.viewsLastWeek > 0
        ? ((summary.viewsThisWeek - summary.viewsLastWeek) / summary.viewsLastWeek * 100).toFixed(0)
        : summary.viewsThisWeek > 0 ? '+100' : '0';

    return (
        <Box>
            <Typography variant="h5" fontWeight="bold" mb={3}>
                📊 Analytics
            </Typography>

            {/* Summary Cards */}
            <Grid container spacing={2} mb={3}>
                <Grid item xs={6} md={3}>
                    <StatCard
                        title="Total Views"
                        value={summary.totalViews.toLocaleString()}
                        subtitle="All time"
                        icon={<VisibilityIcon />}
                        color="#1976d2"
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard
                        title="Unique Visitors"
                        value={summary.uniqueVisitors.toLocaleString()}
                        subtitle={`${summary.trailsWithViews} trails viewed`}
                        icon={<PeopleIcon />}
                        color="#9c27b0"
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard
                        title="Views This Week"
                        value={summary.viewsThisWeek.toLocaleString()}
                        subtitle={`${weekChange}% vs last week`}
                        icon={<CalendarTodayIcon />}
                        color="#2e7d32"
                    />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard
                        title="Avg Views / Trail"
                        value={summary.avgViewsPerTrail}
                        subtitle={`Across ${summary.trailsWithViews} trails`}
                        icon={<RouteIcon />}
                        color="#ed6c02"
                    />
                </Grid>
            </Grid>

            {/* Views Over Time */}
            <Paper elevation={2} sx={{ p: 2.5, mb: 3 }}>
                <Typography variant="h6" fontWeight="bold" mb={2}>
                    Views Over Time (Last 30 Days)
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={filledDailyViews}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(val: string) => {
                                const d = new Date(val);
                                return `${d.getDate()}/${d.getMonth() + 1}`;
                            }}
                            fontSize={12}
                            interval="preserveStartEnd"
                        />
                        <YAxis fontSize={12} allowDecimals={false} />
                        <Tooltip
                            labelFormatter={(label) => new Date(String(label)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        />
                        <Area
                            type="monotone"
                            dataKey="views"
                            stroke="#1976d2"
                            fill="#1976d2"
                            fillOpacity={0.15}
                            strokeWidth={2}
                            name="Views"
                        />
                        <Line
                            type="monotone"
                            dataKey="uniqueVisitors"
                            stroke="#9c27b0"
                            strokeWidth={2}
                            dot={false}
                            name="Unique Visitors"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </Paper>

            <Grid container spacing={3} mb={3}>
                {/* Peak Hours */}
                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 2.5, height: '100%' }}>
                        <Typography variant="h6" fontWeight="bold" mb={2}>
                            Peak Browsing Hours
                        </Typography>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={filledHourlyViews}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="label" fontSize={10} interval={2} />
                                <YAxis fontSize={12} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="views" name="Views" radius={[4, 4, 0, 0]}>
                                    {filledHourlyViews.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={`rgba(46, 125, 50, ${0.3 + (entry.views / maxHourlyViews) * 0.7})`}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Top 10 Most Popular */}
                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 2.5, height: '100%' }}>
                        <Typography variant="h6" fontWeight="bold" mb={2}>
                            Top 10 Most Popular (All-Time)
                        </Typography>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={topTrails} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" fontSize={12} allowDecimals={false} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={130}
                                    fontSize={11}
                                    tickFormatter={(val: string) => val.length > 20 ? val.slice(0, 18) + '…' : val}
                                />
                                <Tooltip />
                                <Bar dataKey="viewCount" name="Views" radius={[0, 4, 4, 0]}>
                                    {topTrails.map((_, index) => (
                                        <Cell key={index} fill={COLORS[index] || COLORS[COLORS.length - 1]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>

            {/* Trending Table */}
            <Paper elevation={2} sx={{ p: 2.5 }}>
                <Typography variant="h6" fontWeight="bold" mb={2}>
                    Trending — This Week vs Last Week
                </Typography>
                {trendingTrails.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        Not enough data yet — check back after a week of views.
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Trail</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>This Week</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Last Week</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Change</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {trendingTrails.map((trail, idx) => (
                                    <TableRow key={trail.slug} hover>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={500}>
                                                {trail.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">{trail.viewsThisWeek}</TableCell>
                                        <TableCell align="right">{trail.viewsLastWeek}</TableCell>
                                        <TableCell align="right">
                                            <WeekChangeChip thisWeek={trail.viewsThisWeek} lastWeek={trail.viewsLastWeek} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
}

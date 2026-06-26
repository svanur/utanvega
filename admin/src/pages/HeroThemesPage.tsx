import {
    Alert,
    Box,
    Chip,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { HERO_THEMES, type HeroTheme } from '../data/heroThemes';

function formatDates(theme: HeroTheme): string {
    if (theme.holidayKey) {
        const before = theme.holidayDaysBefore ? `−${theme.holidayDaysBefore}d` : '';
        const after = theme.holidayDaysAfter ? `+${theme.holidayDaysAfter}d` : '';
        const window = [before, after].filter(Boolean).join(' / ');
        return `holidayKey: "${theme.holidayKey}"${window ? ` (${window})` : ''}`;
    }
    if (theme.recurring) {
        const { month, day, daysBefore = 0, daysAfter = 0 } = theme.recurring;
        const monthName = new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' });
        return `Every year: ${monthName} ${day - daysBefore}–${day + daysAfter}`;
    }
    if (theme.oneOff) {
        return `${theme.oneOff.from} → ${theme.oneOff.to}`;
    }
    return '—';
}

function formatMilestones(theme: HeroTheme): string {
    if (!theme.recurring) return '—';
    const { milestones, milestoneRange } = theme.recurring;
    const parts: string[] = [];
    if (milestones && milestones.length > 0) parts.push(milestones.join(', '));
    if (milestoneRange && milestoneRange.length > 0)
        parts.push(milestoneRange.map(r => `every day ${r.from}→${r.to}`).join(', '));
    return parts.length > 0 ? parts.join(' + ') : 'all days in window';
}

function getStatus(theme: HeroTheme): 'active' | 'upcoming' | 'past' {
    const now = new Date();
    const year = now.getFullYear();
    if (theme.holidayKey) {
        // Admin can't resolve dynamic dates without the JSON — show as upcoming if not clearly past
        return 'upcoming';
    }
    if (theme.recurring) {
        const { month, day, daysBefore = 0, daysAfter = 0 } = theme.recurring;
        const from = new Date(year, month - 1, day - daysBefore);
        const to = new Date(year, month - 1, day + daysAfter, 23, 59, 59);
        if (now >= from && now <= to) return 'active';
        return now < from ? 'upcoming' : 'past';
    }
    if (theme.oneOff) {
        const from = new Date(theme.oneOff.from);
        const to = new Date(theme.oneOff.to);
        to.setHours(23, 59, 59, 999);
        if (now >= from && now <= to) return 'active';
        return now < from ? 'upcoming' : 'past';
    }
    return 'past';
}

const STATUS_CHIP: Record<string, { label: string; color: 'success' | 'primary' | 'default' }> = {
    active:   { label: 'Active now',      color: 'success' },
    upcoming: { label: 'Upcoming',        color: 'primary' },
    past:     { label: 'Past (this year)', color: 'default' },
};

function Section({ title, icon }: { title: string; icon: React.ReactNode }) {
    return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            {icon}
            <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        </Stack>
    );
}

export default function HeroThemesPage() {
    const activeTheme = HERO_THEMES.find(t => getStatus(t) === 'active') ?? null;

    return (
        <Stack spacing={4}>

            {/* ── Header ── */}
            <Box>
                <Typography variant="h5" fontWeight={700}>Hero Band Themes</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Read-only view. To add or change themes, edit{' '}
                    <code>frontend/data/heroThemes.ts</code> and <code>admin/src/data/heroThemes.ts</code>, then deploy.
                </Typography>
                <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
                    Controlled by feature flag <strong>hero_band</strong>. The band only renders when this flag is enabled <em>and</em> a theme's date window matches today. Toggle it on the <strong>Features</strong> page.
                </Alert>
                <Box sx={{ mt: 1.5 }}>
                    {activeTheme ? (
                        <Chip icon={<CheckCircleOutlineIcon />} label={`Active now: ${activeTheme.name}`} color="success" size="small" />
                    ) : (
                        <Chip label="No theme active today" size="small" />
                    )}
                </Box>
            </Box>

            {/* ── Theme overview table ── */}
            <Box>
                <Section title="Themes" icon={<CheckCircleOutlineIcon color="action" />} />
                <Paper variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                                <TableCell>Name</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Date window</TableCell>
                                <TableCell>Milestones</TableCell>
                                <TableCell align="center">Enabled</TableCell>
                                <TableCell align="center">Priority</TableCell>
                                <TableCell>Image</TableCell>
                                <TableCell>Link</TableCell>
                                <TableCell>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[...HERO_THEMES].sort((a, b) => b.priority - a.priority).map(theme => {
                                const isDisabled = theme.enabled === false;
                                const status = getStatus(theme);
                                const chip = STATUS_CHIP[status];
                                return (
                                    <TableRow key={theme.id} sx={{ bgcolor: isDisabled ? 'action.disabledBackground' : status === 'active' ? 'success.50' : undefined, opacity: isDisabled ? 0.6 : 1 }}>
                                        <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Tooltip title={`Light: ${theme.gradient}`}>
                                                    <Box sx={{ width: 16, height: 16, borderRadius: '3px', background: theme.gradient, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
                                                </Tooltip>
                                                <Stack spacing={0.25}>
                                                    <Typography variant="body2" fontWeight={600}>{theme.name}</Typography>
                                                    {theme.holidayKey && (
                                                        <Chip icon={<EventOutlinedIcon />} label={`holidayKey: ${theme.holidayKey}`} size="small" variant="outlined" color="info" sx={{ fontSize: '0.65rem', height: 18 }} />
                                                    )}
                                                </Stack>
                                            </Stack>
                                        </TableCell>
                                        <TableCell><Typography variant="caption" color="text.secondary">{theme.description}</Typography></TableCell>
                                        <TableCell><Typography variant="caption">{formatDates(theme)}</Typography></TableCell>
                                        <TableCell><Typography variant="caption">{formatMilestones(theme)}</Typography></TableCell>
                                        <TableCell align="center">
                                            {isDisabled
                                                ? <Chip label="Disabled" color="default" size="small" />
                                                : <Chip label="Enabled" color="success" size="small" variant="outlined" />
                                            }
                                        </TableCell>
                                        <TableCell align="center">{theme.priority}</TableCell>
                                        <TableCell>
                                            {theme.imagePath
                                                ? <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{theme.imagePath}</Typography>
                                                : <Typography variant="caption" color="text.disabled">none</Typography>}
                                        </TableCell>
                                        <TableCell>
                                            {theme.externalUrl ? (
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <Typography variant="caption" component="a" href={theme.externalUrl} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main' }}>
                                                        {new URL(theme.externalUrl).hostname}
                                                    </Typography>
                                                    <OpenInNewIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                                </Stack>
                                            ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                                        </TableCell>
                                        <TableCell>
                                            {!isDisabled && <Chip label={chip.label} color={chip.color} size="small" />}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>

            {/* ── Strings & countdown table ── */}
            <Box>
                <Section title="Strings & countdown" icon={<MenuBookOutlinedIcon color="action" />} />
                <Paper variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                                <TableCell>Name</TableCell>
                                <TableCell>Header line</TableCell>
                                <TableCell>Tagline</TableCell>
                                <TableCell>Countdown</TableCell>
                                <TableCell>Suffix</TableCell>
                                <TableCell>Race day text</TableCell>
                                <TableCell>Font color</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {HERO_THEMES.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell><Typography variant="body2" fontWeight={600}>{t.name}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{t.headerLine ?? <em style={{ color: '#999' }}>none</em>}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{t.tagline ?? <em style={{ color: '#999' }}>none</em>}</Typography></TableCell>
                                    <TableCell>
                                        <Chip label={t.showCountdown ? 'enabled' : 'disabled'} color={t.showCountdown ? 'success' : 'default'} size="small" />
                                    </TableCell>
                                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{t.countdownSuffix ?? <em style={{ color: '#999' }}>none</em>}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{t.raceDayText ?? <em style={{ color: '#999' }}>none</em>}</Typography></TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: t.fontColor ?? 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{t.fontColor ?? 'default (white)'}</Typography>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>

            <Divider />

            {/* ── Field reference ── */}
            <Box>
                <Section title="Field reference" icon={<MenuBookOutlinedIcon color="action" />} />
                <Stack spacing={2}>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Date window fields</Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                                    <TableCell>Field</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Description</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {[
                                    ['recurring.month', 'number (1–12)', 'Calendar month of race day'],
                                    ['recurring.day', 'number', 'Day of month of race day'],
                                    ['recurring.daysBefore', 'number', 'How many days before race day the window opens'],
                                    ['recurring.daysAfter', 'number', 'How many days after race day the window stays open'],
                                    ['recurring.milestones', 'number[]', 'Exact days-until values on which the band appears (e.g. [100, 90, 80])'],
                                    ['recurring.milestoneRange', '{ from, to }[]', 'Array of day ranges — show every day between from and to inclusive. E.g. [{ from: 10, to: 1 }] or multiple ranges [{ from: 100, to: 90 }, { from: 10, to: 1 }]'],
                                    ['enabled', 'boolean', 'Set to false to disable a theme without removing it. Omit or set to true to enable (default).'],
                                    ['holidayKey', 'string', 'Look up the date from is-holidays.json by holiday name (e.g. "Bolludagur"). Use for Easter-relative days whose date shifts every year.'],
                                    ['holidayDaysBefore', 'number', 'Days before the looked-up holiday date to open the window (default 0)'],
                                    ['holidayDaysAfter', 'number', 'Days after the looked-up holiday date to keep the window open (default 0)'],
                                    ['oneOff.from', 'YYYY-MM-DD', 'Start date for a one-time theme'],
                                    ['oneOff.to', 'YYYY-MM-DD', 'End date for a one-time theme (inclusive)'],
                                ].map(([field, type, desc]) => (
                                    <TableRow key={field}>
                                        <TableCell><code>{field}</code></TableCell>
                                        <TableCell><Typography variant="caption" color="text.secondary">{type}</Typography></TableCell>
                                        <TableCell><Typography variant="caption">{desc}</Typography></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Visual fields</Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                                    <TableCell>Field</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Description</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {[
                                    ['gradient', 'CSS string', 'Background gradient used in light mode (also used when no image)'],
                                    ['gradientDark', 'CSS string', 'Background gradient used in dark mode'],
                                    ['imagePath', 'string', 'Path to background image in /public/themes/ (e.g. /themes/laugavegur-ultra.webp)'],
                                    ['imagePosition', 'left | center | right', 'Which side of the image to anchor (default: center)'],
                                    ['fontColor', 'CSS color', 'Text color for all strings (default: white)'],
                                    ['headerLine', 'string', 'Large bold heading shown above the tagline'],
                                    ['tagline', 'string', 'Smaller subtitle line below the header'],
                                    ['externalUrl', 'URL', 'Clickable link shown at the bottom of the band'],
                                ].map(([field, type, desc]) => (
                                    <TableRow key={field}>
                                        <TableCell><code>{field}</code></TableCell>
                                        <TableCell><Typography variant="caption" color="text.secondary">{type}</Typography></TableCell>
                                        <TableCell><Typography variant="caption">{desc}</Typography></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Countdown fields</Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                                    <TableCell>Field</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Description</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {[
                                    ['showCountdown', 'boolean', 'Enable the countdown display (default: false)'],
                                    ['countdownSuffix', 'string', 'Text shown after the number, e.g. "DAGAR" → "16 DAGAR"'],
                                    ['raceDayText', 'string', 'Replaces the countdown on race day itself'],
                                ].map(([field, type, desc]) => (
                                    <TableRow key={field}>
                                        <TableCell><code>{field}</code></TableCell>
                                        <TableCell><Typography variant="caption" color="text.secondary">{type}</Typography></TableCell>
                                        <TableCell><Typography variant="caption">{desc}</Typography></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Priority & overlap rules</Typography>
                        <Stack spacing={0.5}>
                            {[
                                'Higher priority number wins when two themes overlap on the same day.',
                                'If two themes have equal priority, the first one in the HERO_THEMES array is shown.',
                                'Recommended: national holidays → 20+, major races → 10, general seasonal → 1–5.',
                                'milestones and milestoneRange work together — a day matching either will show the band.',
                                'Race day (daysUntil = 0) and daysAfter always show regardless of milestones.',
                                'oneOff themes are useful for one-time events — remember to remove them after the event.',
                            ].map((rule, i) => (
                                <Typography key={i} variant="body2">• {rule}</Typography>
                            ))}
                        </Stack>
                    </Paper>

                </Stack>
            </Box>

            <Divider />

            {/* ── Image guidelines ── */}
            <Box>
                <Section title="Image guidelines" icon={<ImageOutlinedIcon color="action" />} />
                <Stack spacing={2}>
                    <Alert severity="info" variant="outlined">
                        Images live in <code>frontend/public/themes/</code>. The filename must match the theme's <code>imagePath</code> exactly.
                        Example: <code>/themes/laugavegur-ultra.webp</code> → file at <code>frontend/public/themes/laugavegur-ultra.webp</code>
                    </Alert>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Recommended dimensions</Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                                    <TableCell>Use case</TableCell>
                                    <TableCell>Dimensions</TableCell>
                                    <TableCell>Max file size</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {[
                                    ['Hero band background (standard)', '900 × 120 px', '80 KB'],
                                    ['Hero band background (retina/2x)', '1800 × 240 px', '150 KB'],
                                ].map(([use, dim, size]) => (
                                    <TableRow key={use}>
                                        <TableCell>{use}</TableCell>
                                        <TableCell><code>{dim}</code></TableCell>
                                        <TableCell>{size}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Format & quality rules</Typography>
                        <Stack spacing={0.5}>
                            {[
                                'Prefer .webp for photos and complex images — best compression.',
                                'Use .png for logos with transparency (e.g. race logos on transparent background).',
                                'Avoid .jpg for logos — compression artefacts look bad on gradient backgrounds.',
                                'Always compress before committing. Use squoosh.app or ImageOptim.',
                                'The card is 900 px wide and 120 px tall — use a wide landscape crop, not portrait.',
                                'The left ~60% of the image is covered by a dark scrim + text. Put the visually interesting part on the RIGHT side.',
                                'backgroundSize is "cover" — the image fills the card and any excess height is clipped.',
                                'Provide imageAlt in the theme definition for screen reader accessibility.',
                            ].map((rule, i) => (
                                <Typography key={i} variant="body2">• {rule}</Typography>
                            ))}
                        </Stack>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Adding or removing a theme</Typography>
                        <Stack spacing={0.5}>
                            {[
                                '1. Add the image to frontend/public/themes/ and commit.',
                                '2. Add the entry in both frontend/data/heroThemes.ts AND admin/src/data/heroThemes.ts.',
                                '3. Deploy frontend + admin — the band appears automatically on the active dates.',
                                '4. One-off events: remove the theme entry after the event ends.',
                                '5. Recurring themes: no cleanup needed — they reactivate automatically each year.',
                            ].map((step, i) => (
                                <Typography key={i} variant="body2">{step}</Typography>
                            ))}
                        </Stack>
                    </Paper>
                </Stack>
            </Box>

        </Stack>
    );
}

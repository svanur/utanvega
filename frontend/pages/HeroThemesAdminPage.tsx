import { Box, Chip, Divider, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import Layout from '../components/Layout';
import { HERO_THEMES, type HeroTheme } from '../data/heroThemes';
import { useHeroTheme } from '../hooks/useHeroTheme';

interface Props {
    mode: PaletteMode;
    onToggleMode: () => void;
}

function formatDates(theme: HeroTheme): string {
    if (theme.recurring) {
        const { month, day, daysAfter = 0 } = theme.recurring;
        const monthName = new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' });
        const end = day + daysAfter;
        return `Every year: ${monthName} ${day}–${end}`;
    }
    if (theme.oneOff) {
        return `${theme.oneOff.from} → ${theme.oneOff.to}`;
    }
    return '—';
}

function getStatus(theme: HeroTheme): 'active' | 'upcoming' | 'past' | 'unknown' {
    const now = new Date();
    const year = now.getFullYear();

    if (theme.recurring) {
        const { month, day, daysAfter = 0 } = theme.recurring;
        const from = new Date(year, month - 1, day);
        const to = new Date(year, month - 1, day + daysAfter, 23, 59, 59);
        if (now >= from && now <= to) return 'active';
        if (now < from) return 'upcoming';
        return 'past';
    }
    if (theme.oneOff) {
        const from = new Date(theme.oneOff.from);
        const to = new Date(theme.oneOff.to);
        to.setHours(23, 59, 59, 999);
        if (now >= from && now <= to) return 'active';
        if (now < from) return 'upcoming';
        return 'past';
    }
    return 'unknown';
}

const STATUS_CHIP: Record<string, { label: string; color: 'success' | 'primary' | 'default' | 'warning' }> = {
    active:   { label: 'Active now', color: 'success' },
    upcoming: { label: 'Upcoming',   color: 'primary' },
    past:     { label: 'Past (this year)', color: 'default' },
    unknown:  { label: 'Unknown',    color: 'warning' },
};

export default function HeroThemesAdminPage({ mode, onToggleMode }: Props) {
    const activeTheme = useHeroTheme();

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth="lg">
            <Stack spacing={4}>

                {/* Header */}
                <Box>
                    <Typography variant="h5" fontWeight={700}>Hero Band Themes</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Read-only view. To add or change themes, edit{' '}
                        <code>frontend/data/heroThemes.ts</code> and deploy.
                    </Typography>
                    {activeTheme && (
                        <Chip
                            icon={<CheckCircleOutlineIcon />}
                            label={`Active now: ${activeTheme.name}`}
                            color="success"
                            size="small"
                            sx={{ mt: 1 }}
                        />
                    )}
                    {!activeTheme && (
                        <Chip label="No theme active today" size="small" sx={{ mt: 1 }} />
                    )}
                </Box>

                {/* Theme table */}
                <Paper variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                                <TableCell>Name</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Dates</TableCell>
                                <TableCell>Priority</TableCell>
                                <TableCell>Image path</TableCell>
                                <TableCell>Link</TableCell>
                                <TableCell>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {HERO_THEMES.sort((a, b) => b.priority - a.priority).map(theme => {
                                const status = getStatus(theme);
                                const chip = STATUS_CHIP[status];
                                return (
                                    <TableRow
                                        key={theme.id}
                                        sx={{ bgcolor: status === 'active' ? 'success.main' : undefined, opacity: status === 'active' ? 0.08 : 1 }}
                                    >
                                        <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Box
                                                    sx={{
                                                        width: 14,
                                                        height: 14,
                                                        borderRadius: '3px',
                                                        background: theme.gradient,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <Typography variant="body2" fontWeight={600}>{theme.name}</Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">{theme.description}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption">{formatDates(theme)}</Typography>
                                        </TableCell>
                                        <TableCell align="center">{theme.priority}</TableCell>
                                        <TableCell>
                                            {theme.imagePath ? (
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{theme.imagePath}</Typography>
                                            ) : (
                                                <Typography variant="caption" color="text.disabled">none</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {theme.externalUrl ? (
                                                <Typography
                                                    variant="caption"
                                                    component="a"
                                                    href={theme.externalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    sx={{ color: 'primary.main' }}
                                                >
                                                    {new URL(theme.externalUrl).hostname}
                                                </Typography>
                                            ) : (
                                                <Typography variant="caption" color="text.disabled">—</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={chip.label} color={chip.color} size="small" />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>

                {/* Taglines */}
                <Box>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>Taglines</Typography>
                    <Stack spacing={1}>
                        {HERO_THEMES.map(t => (
                            <Box key={t.id}>
                                <Typography variant="caption" color="text.secondary">{t.name}: </Typography>
                                <Typography variant="caption">{t.tagline ?? <em>none</em>}</Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>

                <Divider />

                {/* Image guidelines */}
                <Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <ImageOutlinedIcon color="action" />
                        <Typography variant="subtitle1" fontWeight={700}>Image guidelines</Typography>
                    </Stack>

                    <Stack spacing={2}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>File location</Typography>
                            <Typography variant="body2">
                                All theme images live in <code>/public/themes/</code> in the frontend repo.
                                The filename must match the theme's <code>imagePath</code> value exactly, including the leading slash.
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Example: <code>/public/themes/laugavegur-ultra.png</code>
                            </Typography>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Recommended dimensions</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Use case</TableCell>
                                        <TableCell>Dimensions</TableCell>
                                        <TableCell>Max file size</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>Race / event logo</TableCell>
                                        <TableCell>400 × 200 px</TableCell>
                                        <TableCell>80 KB</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Wide seasonal banner</TableCell>
                                        <TableCell>1200 × 300 px</TableCell>
                                        <TableCell>150 KB</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Icon / emblem</TableCell>
                                        <TableCell>200 × 200 px</TableCell>
                                        <TableCell>40 KB</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Format & quality</Typography>
                            <Stack spacing={0.5}>
                                {[
                                    'Prefer .webp for photos and complex images (best compression).',
                                    'Use .png for logos with transparency (e.g. race logos on transparent background).',
                                    'Avoid .jpg for logos — compression artefacts look bad on gradient backgrounds.',
                                    'Always compress before committing. Use Squoosh (squoosh.app) or ImageOptim.',
                                    'Test on both light and dark mode — logos with dark text become invisible on dark gradients.',
                                    'Provide imageAlt text in the theme definition for screen reader accessibility.',
                                ].map((rule, i) => (
                                    <Typography key={i} variant="body2">• {rule}</Typography>
                                ))}
                            </Stack>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Adding or removing a theme</Typography>
                            <Stack spacing={0.5}>
                                {[
                                    '1. Add the image file to /public/themes/ and commit it.',
                                    '2. Add or edit the entry in frontend/data/heroThemes.ts.',
                                    '3. Deploy the frontend — the band appears automatically on the active dates.',
                                    '4. For one-off events: clean up by removing the theme entry after the event ends.',
                                    '5. For recurring themes: no cleanup needed — they re-activate automatically each year.',
                                ].map((step, i) => (
                                    <Typography key={i} variant="body2">{step}</Typography>
                                ))}
                            </Stack>
                        </Paper>
                    </Stack>
                </Box>

            </Stack>
        </Layout>
    );
}

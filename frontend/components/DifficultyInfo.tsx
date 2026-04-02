import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Box,
    useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const difficultyColors: Record<string, 'success' | 'info' | 'warning' | 'error' | 'secondary'> = {
    Easy: 'success',
    Moderate: 'info',
    Hard: 'warning',
    Expert: 'error',
    Extreme: 'secondary',
};

interface ThresholdRow {
    level: string;
    trailRunning: string;
    running: string;
    hiking: string;
    cycling: string;
}

const rows: ThresholdRow[] = [
    { level: 'Easy',     trailRunning: '< 12 km', running: '< 10 km',  hiking: '< 8 km',  cycling: '< 30 km' },
    { level: 'Moderate', trailRunning: '< 25 km', running: '< 21 km',  hiking: '< 16 km', cycling: '< 70 km' },
    { level: 'Hard',     trailRunning: '< 50 km', running: '< 42 km',  hiking: '< 30 km', cycling: '< 140 km' },
    { level: 'Expert',   trailRunning: '< 90 km', running: '< 100 km', hiking: '< 55 km', cycling: '< 250 km' },
    { level: 'Extreme',  trailRunning: '≥ 90 km', running: '≥ 100 km', hiking: '≥ 55 km', cycling: '≥ 250 km' },
];

interface DifficultyInfoProps {
    difficulty: string;
    activityType?: string;
}

export default function DifficultyInfo({ difficulty, activityType }: DifficultyInfoProps) {
    const [open, setOpen] = useState(false);
    const theme = useTheme();

    const activeColumn = activityType?.toLowerCase() as keyof ThresholdRow | undefined;

    const colHighlight = (col: string) =>
        activeColumn === col ? { bgcolor: theme.palette.action.selected } : undefined;

    return (
        <>
            <Chip
                label={difficulty}
                size="small"
                color={difficultyColors[difficulty] || 'info'}
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                clickable
            />

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pr: 6 }}>
                    Difficulty Rating Criteria
                    <IconButton
                        aria-label="close"
                        onClick={() => setOpen(false)}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Difficulty is calculated using <strong>effort distance</strong>: the trail distance plus elevation gain divided by 100.
                        For road running, only distance is used. Thresholds vary by activity type.
                    </Typography>

                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: theme.palette.action.hover }}>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Level</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', ...colHighlight('trailrunning') }}>Trail Running</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', ...colHighlight('running') }}>Running</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', ...colHighlight('hiking') }}>Hiking</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', ...colHighlight('cycling') }}>Cycling</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow 
                                        key={row.level}
                                        sx={row.level === difficulty ? { bgcolor: theme.palette.action.selected } : undefined}
                                    >
                                        <TableCell>
                                            <Chip
                                                label={row.level}
                                                size="small"
                                                color={difficultyColors[row.level]}
                                                variant={row.level === difficulty ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                        <TableCell sx={colHighlight('trailrunning')}>{row.trailRunning}</TableCell>
                                        <TableCell sx={colHighlight('running')}>{row.running}</TableCell>
                                        <TableCell sx={colHighlight('hiking')}>{row.hiking}</TableCell>
                                        <TableCell sx={colHighlight('cycling')}>{row.cycling}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box mt={2}>
                        <Typography variant="caption" color="text.secondary">
                            <strong>Effort distance</strong> = distance (km) + elevation gain (m) ÷ 100.
                            For example, a 15 km trail with 800 m gain = 23 km effort.
                        </Typography>
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}

import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

const rows = [
    { activity: 'trailrunning',   i18nKey: 'difficulty.trailRunning',   speed: '10 km/h', climbPenalty: '2.5 min / 100m' },
    { activity: 'running',        i18nKey: 'difficulty.running',        speed: '11 km/h', climbPenalty: '1.5 min / 100m' },
    { activity: 'hiking',         i18nKey: 'difficulty.hiking',         speed: '4 km/h',  climbPenalty: '10 min / 100m' },
    { activity: 'cycling',        i18nKey: 'difficulty.cycling',        speed: '20 km/h', climbPenalty: '3 min / 100m' },
    { activity: 'funrun',         i18nKey: 'difficulty.funRun',         speed: '9 km/h',  climbPenalty: '1.5 min / 100m' },
    { activity: 'obstaclecourse', i18nKey: 'difficulty.obstacleCourse', speed: '5 km/h',  climbPenalty: '4 min / 100m' },
    { activity: 'crosscountryrun',i18nKey: 'difficulty.crossCountryRun',speed: '9.5 km/h',climbPenalty: '2 min / 100m' },
];

interface PaceModelTableProps {
    highlightActivity?: string;
}

export default function PaceModelTable({ highlightActivity }: PaceModelTableProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const active = highlightActivity?.toLowerCase();

    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('paceModel.explanation')}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: theme.palette.action.hover }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>{t('paceModel.activity')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{t('paceModel.baseSpeed')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{t('paceModel.climbPenalty')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow
                                key={row.activity}
                                sx={row.activity === active ? { bgcolor: theme.palette.action.selected } : undefined}
                            >
                                <TableCell sx={{ fontWeight: row.activity === active ? 'bold' : undefined }}>
                                    {t(row.i18nKey)}
                                </TableCell>
                                <TableCell>{row.speed}</TableCell>
                                <TableCell>{row.climbPenalty}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box mt={2}>
                <Typography variant="caption" color="text.secondary">
                    {t('paceModel.formula')}
                </Typography>
            </Box>
        </Box>
    );
}

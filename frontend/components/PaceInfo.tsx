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
    Box,
    Stack,
    useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';

interface PaceRow {
    activity: string;
    i18nKey: string;
    speed: string;
    climbPenalty: string;
}

const rows: PaceRow[] = [
    { activity: 'trailrunning', i18nKey: 'difficulty.trailRunning', speed: '7 km/h',  climbPenalty: '3 min / 100m' },
    { activity: 'running',      i18nKey: 'difficulty.running',      speed: '9 km/h',  climbPenalty: '2 min / 100m' },
    { activity: 'hiking',       i18nKey: 'difficulty.hiking',       speed: '4 km/h',  climbPenalty: '10 min / 100m' },
    { activity: 'cycling',      i18nKey: 'difficulty.cycling',      speed: '20 km/h', climbPenalty: '3 min / 100m' },
];

interface PaceInfoProps {
    activityType?: string;
    formattedDuration: string;
}

export default function PaceInfo({ activityType, formattedDuration }: PaceInfoProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const theme = useTheme();

    const activeRow = activityType?.toLowerCase();

    return (
        <>
            <Stack
                alignItems="center"
                spacing={0.5}
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                sx={{
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 },
                }}
            >
                <AccessTimeIcon color="action" fontSize="small" />
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                    {t('trail.estTime')}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', borderBottom: `1px dashed ${theme.palette.text.secondary}`, pb: '1px' }}>
                    ~{formattedDuration}
                </Typography>
            </Stack>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pr: 6 }}>
                    {t('paceModel.dialogTitle')}
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
                                        sx={row.activity === activeRow ? { bgcolor: theme.palette.action.selected } : undefined}
                                    >
                                        <TableCell sx={{ fontWeight: row.activity === activeRow ? 'bold' : undefined }}>
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
                </DialogContent>
            </Dialog>
        </>
    );
}

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Stack, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import PaceModelTable from './PaceModelTable';

interface PaceInfoProps {
    activityType?: string;
    formattedDuration: string;
}

export default function PaceInfo({ activityType, formattedDuration }: PaceInfoProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const [open, setOpen] = useState(false);

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
                    <PaceModelTable highlightActivity={activityType} />
                </DialogContent>
            </Dialog>
        </>
    );
}

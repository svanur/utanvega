import { Box, CircularProgress, IconButton, Snackbar, Tooltip } from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import OfflinePinIcon from '@mui/icons-material/OfflinePin';
import { useTranslation } from 'react-i18next';
import { useOfflineTrails } from '../hooks/useOfflineTrails';
import { useState } from 'react';

interface OfflineButtonProps {
    slug: string;
    trailName: string;
}

export default function OfflineButton({ slug, trailName }: OfflineButtonProps) {
    const { t } = useTranslation();
    const { isOffline, saving, progress, saveTrailOffline, removeTrailOffline } = useOfflineTrails();
    const [snackbar, setSnackbar] = useState<string | null>(null);
    const isSaved = isOffline(slug);
    const isSaving = saving === slug;

    const handleClick = async () => {
        try {
            if (isSaved) {
                await removeTrailOffline(slug);
                setSnackbar(t('offline.removed'));
            } else {
                await saveTrailOffline(slug);
                setSnackbar(t('offline.savedSuccess', { name: trailName }));
            }
        } catch {
            setSnackbar(isSaved ? t('offline.removeFailed') : t('offline.saveFailed'));
        }
    };

    if (isSaving) {
        return (
            <Tooltip title={t('offline.cachingTiles', { percent: Math.round(progress) })} arrow>
                <Box sx={{ position: 'relative', display: 'inline-flex', width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress
                        variant="determinate"
                        value={progress}
                        size={28}
                        thickness={4}
                    />
                </Box>
            </Tooltip>
        );
    }

    return (
        <>
            <Tooltip title={isSaved ? t('offline.removeOffline') : t('offline.saveForOffline')} arrow>
                <IconButton size="small" onClick={handleClick}>
                    {isSaved
                        ? <OfflinePinIcon fontSize="small" color="success" />
                        : <CloudDownloadIcon fontSize="small" />
                    }
                </IconButton>
            </Tooltip>
            <Snackbar
                open={!!snackbar}
                autoHideDuration={3000}
                onClose={() => setSnackbar(null)}
                message={snackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </>
    );
}

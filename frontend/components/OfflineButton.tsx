import { Box, Button, CircularProgress, LinearProgress, Tooltip, Typography } from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import OfflinePinIcon from '@mui/icons-material/OfflinePin';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
    const [error, setError] = useState<string | null>(null);
    const isSaved = isOffline(slug);
    const isSaving = saving === slug;

    const handleSave = async () => {
        setError(null);
        try {
            await saveTrailOffline(slug);
        } catch {
            setError(t('offline.saveFailed'));
        }
    };

    const handleRemove = async () => {
        setError(null);
        try {
            await removeTrailOffline(slug);
        } catch {
            setError(t('offline.removeFailed'));
        }
    };

    if (isSaving) {
        return (
            <Box sx={{ my: 2 }}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                        {t('offline.saving', { name: trailName })}
                    </Typography>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ borderRadius: 1, height: 6 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {progress < 10 ? t('offline.fetchingData') :
                     progress < 95 ? t('offline.cachingTiles', { percent: progress }) :
                     t('offline.finishing')}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ my: 2 }}>
            {isSaved ? (
                <Box display="flex" alignItems="center" gap={1}>
                    <Tooltip title={t('offline.availableOffline')}>
                        <Box display="flex" alignItems="center" gap={0.5}>
                            <OfflinePinIcon color="success" fontSize="small" />
                            <Typography variant="body2" color="success.main" fontWeight="bold">
                                {t('offline.saved')}
                            </Typography>
                        </Box>
                    </Tooltip>
                    <Button
                        size="small"
                        color="error"
                        variant="text"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={handleRemove}
                        sx={{ ml: 'auto' }}
                    >
                        {t('offline.remove')}
                    </Button>
                </Box>
            ) : (
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloudDownloadIcon />}
                    onClick={handleSave}
                    fullWidth
                    sx={{ borderRadius: 2 }}
                >
                    {t('offline.saveForOffline')}
                </Button>
            )}
            {error && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
}

import React, { useState } from 'react';
import { 
    IconButton, 
    Tooltip, 
    Snackbar, 
    Alert
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';

interface ShareButtonsProps {
    title: string;
    url?: string;
}

export default function ShareButtons({ title, url }: ShareButtonsProps) {
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const shareUrl = url || window.location.href;

    const handleShare = async () => {
        if (typeof navigator.share !== 'undefined') {
            try {
                await navigator.share({
                    title,
                    url: shareUrl,
                });
            } catch (error) {
                // Ignore AbortError which occurs when user cancels sharing
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Error sharing:', error);
                }
            }
        } else {
            // Fallback for browsers that don't support Web Share API
            navigator.clipboard.writeText(shareUrl);
            setOpenSnackbar(true);
        }
    };

    return (
        <>
            <Tooltip title={typeof navigator.share !== 'undefined' ? "Share" : "Copy Link"}>
                <IconButton onClick={handleShare} color="primary" size="small">
                    <ShareIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Snackbar 
                open={openSnackbar} 
                autoHideDuration={3000} 
                onClose={() => setOpenSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setOpenSnackbar(false)} severity="success" sx={{ width: '100%' }}>
                    Link copied to clipboard!
                </Alert>
            </Snackbar>
        </>
    );
}

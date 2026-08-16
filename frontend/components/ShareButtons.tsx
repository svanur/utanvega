import React, { useState } from 'react';
import { trackTrailShareClick } from '../utils/analytics';
import { 
    IconButton, 
    Tooltip, 
    Snackbar, 
    Alert,
    Button,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import FacebookIcon from '@mui/icons-material/Facebook';
import ForumIcon from '@mui/icons-material/Forum';
import LinkIcon from '@mui/icons-material/Link';
import IosShareIcon from '@mui/icons-material/IosShare';
import { useTranslation } from 'react-i18next';

interface ShareButtonsProps {
    title: string;
    url?: string;
    shareText?: string;
    buttonLabel?: string;
    slug?: string;
}

export default function ShareButtons({ title, url, shareText, buttonLabel, slug }: ShareButtonsProps) {
    const { t } = useTranslation();
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const shareUrl = url || window.location.href;
    const facebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;
    const messengerEnabled = Boolean(facebookAppId?.trim());
    const menuOpen = Boolean(anchorEl);

    const shareTextWithUrl = shareText ? `${shareText}\n${shareUrl}` : shareUrl;

    const openSnackbarWithMessage = (message: string) => {
        setSnackbarMessage(message);
        setOpenSnackbar(true);
    };

    const copyToClipboard = async (text: string, message = t('share.linkCopied')) => {
        await navigator.clipboard.writeText(text);
        openSnackbarWithMessage(message);
    };

    const handleNativeShare = async () => {
        if (typeof navigator.share !== 'undefined') {
            try {
                if (shareText) {
                    await navigator.share({
                        title,
                        text: shareTextWithUrl,
                    });
                } else {
                    await navigator.share({
                        title,
                        url: shareUrl,
                    });
                }
            } catch (error) {
                // Ignore AbortError which occurs when user cancels sharing
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Error sharing:', error);
                }
            }
        } else {
            await copyToClipboard(shareTextWithUrl);
        }
    };

    const handleFacebookShare = () => {
        const params = new URLSearchParams({
            u: shareUrl,
        });
        if (shareText) {
            params.set('quote', shareText);
        }
        window.open(`https://www.facebook.com/sharer/sharer.php?${params.toString()}`, '_blank', 'noopener,noreferrer');
    };

    const handleMessengerShare = () => {
        if (!facebookAppId) return;
        const params = new URLSearchParams({
            app_id: facebookAppId,
            link: shareUrl,
            redirect_uri: window.location.href,
        });
        window.open(`https://www.facebook.com/dialog/send?${params.toString()}`, '_blank', 'noopener,noreferrer');
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        trackTrailShareClick(slug);
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => setAnchorEl(null);

    return (
        <>
            {buttonLabel ? (
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<ShareIcon />}
                    onClick={handleNativeShare}
                    sx={{ textTransform: 'none' }}
                >
                    {buttonLabel}
                </Button>
            ) : (
                <Tooltip title={t('share.shareOptions')}>
                    <IconButton onClick={handleOpenMenu} color="primary" size="small">
                        <ShareIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}

            {!buttonLabel && (
                <Menu
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleCloseMenu}
                >
                    <MenuItem onClick={async () => { handleCloseMenu(); await handleNativeShare(); }}>
                        <ListItemIcon><IosShareIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>{t('share.share')}</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleCloseMenu(); handleFacebookShare(); }}>
                        <ListItemIcon><FacebookIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>{t('share.facebook')}</ListItemText>
                    </MenuItem>
                    {messengerEnabled && (
                        <MenuItem onClick={() => { handleCloseMenu(); handleMessengerShare(); }}>
                            <ListItemIcon><ForumIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>{t('share.messenger')}</ListItemText>
                        </MenuItem>
                    )}
                    <MenuItem onClick={async () => { handleCloseMenu(); await copyToClipboard(shareTextWithUrl); }}>
                        <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>{t('share.copyLink')}</ListItemText>
                    </MenuItem>
                </Menu>
            )}

            <Snackbar 
                open={openSnackbar} 
                autoHideDuration={3000} 
                onClose={() => setOpenSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setOpenSnackbar(false)} severity="success" sx={{ width: '100%' }}>
                    {snackbarMessage || t('share.linkCopied')}
                </Alert>
            </Snackbar>
        </>
    );
}

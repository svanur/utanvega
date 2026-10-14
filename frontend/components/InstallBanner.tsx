import { Box, Button, IconButton, Paper, Slide, Typography } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * Brand icon per locale, matching the per-host icons manifest.ts serves at
 * /manifest.webmanifest (#1080) — keeps the install surface's own branding
 * consistent with whatever icon the OS will actually install.
 */
const BRAND_ICON: Record<string, string> = {
    is: '/icons/hlaupadagskra-icon-192.png',
    en: '/icons/360runs-icon-192.png',
};

export default function InstallBanner() {
    const { t, i18n } = useTranslation();
    const { showBanner, showIOSHint, install, dismiss } = useInstallPrompt();
    const brandIcon = BRAND_ICON[i18n.language] ?? BRAND_ICON.is;

    if (!showBanner && !showIOSHint) return null;

    return (
        <Slide direction="up" in={true} mountOnEnter unmountOnExit>
            <Paper
                elevation={8}
                sx={{
                    position: 'fixed',
                    bottom: 16,
                    left: 16,
                    right: 16,
                    zIndex: 1300,
                    p: 2,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    maxWidth: 500,
                    mx: 'auto',
                }}
            >
                <Box
                    component="img"
                    src={brandIcon}
                    alt=""
                    sx={{ width: 32, height: 32, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                        {t('install.title')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {showIOSHint
                            ? t('install.iosHint')
                            : t('install.description')
                        }
                    </Typography>
                </Box>
                {showBanner && (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<GetAppIcon />}
                        onClick={install}
                        sx={{ whiteSpace: 'nowrap', borderRadius: 2 }}
                    >
                        {t('install.button')}
                    </Button>
                )}
                {showIOSHint && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IosShareIcon fontSize="small" color="primary" />
                        <Typography variant="caption" color="primary" fontWeight="bold">
                            {t('install.iosAction')}
                        </Typography>
                    </Box>
                )}
                <IconButton size="small" onClick={dismiss} sx={{ ml: -1 }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Paper>
        </Slide>
    );
}

import { Box, Button, IconButton, Paper, Slide, Typography } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { localeForHostname, type Locale } from '../api/_site';

/**
 * Brand icon per locale, matching the per-host icons manifest.ts serves at
 * /manifest.webmanifest (#1080) — keeps the install surface's own branding
 * consistent with whatever icon the OS will actually install.
 *
 * Keyed by host (localeForHostname(window.location.hostname)), not by
 * i18n.language/UI language — a visitor who manually toggles the UI
 * language via LanguageToggle.tsx still installs (and is served) the
 * manifest for the host they're actually on, so this banner's icon must
 * track the same host-derived locale manifest.ts's resolveLocale() uses,
 * same signal every other BRAND_NAME/brand-asset consumer keys off (see
 * i18n.ts's brandNameForHostname comment) — not the independently-toggleable
 * UI language, which would otherwise mismatch the icon actually installed.
 */
const BRAND_ICON: Record<Locale, string> = {
    is: '/icons/hlaupadagskra-icon-192.png',
    en: '/icons/360runs-icon-192.png',
};

export default function InstallBanner() {
    const { t } = useTranslation();
    const { showBanner, showIOSHint, install, dismiss } = useInstallPrompt();
    const brandIcon = BRAND_ICON[localeForHostname(window.location.hostname)];

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

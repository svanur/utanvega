import { useState } from 'react';
import { Box, IconButton, Link, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'announcement_dismissed_v1';

export default function AnnouncementBanner() {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(STORAGE_KEY) === 'true'
    );

    if (dismissed) return null;

    const href = t('announcement.href');
    const text = t('announcement.text');
    const linkText = t('announcement.linkText');

    return (
        <Box
            sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                borderTop: '1px solid rgba(255,255,255,0.25)',
                px: 2,
                py: 0.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                position: 'relative',
            }}
        >
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
                {text}{' '}
                <Link
                    href={href}
                    color="inherit"
                    fontWeight={700}
                    underline="always"
                    sx={{ cursor: 'pointer' }}
                >
                    {linkText}
                </Link>
            </Typography>
            <IconButton
                size="small"
                onClick={() => {
                    localStorage.setItem(STORAGE_KEY, 'true');
                    setDismissed(true);
                }}
                sx={{ color: 'inherit', position: 'absolute', right: 8, opacity: 0.8 }}
                aria-label="dismiss"
            >
                <CloseIcon fontSize="small" />
            </IconButton>
        </Box>
    );
}

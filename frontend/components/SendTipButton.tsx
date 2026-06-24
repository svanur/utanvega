import { useState } from 'react';
import { Button, Tooltip } from '@mui/material';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import { useTranslation } from 'react-i18next';
import type { SxProps, Theme } from '@mui/material';

const TO = 'oskar';
const DOMAIN = 'hlaupadagskra.is';

interface SendTipButtonProps {
    name: string;
    type: 'trail' | 'event';
    sx?: SxProps<Theme>;
}

export default function SendTipButton({ name, type, sx }: SendTipButtonProps) {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);

    const subject = encodeURIComponent(`Tip: ${window.location.pathname}`);
    const body = encodeURIComponent(t('tip.body', { url: window.location.href }));
    const href = `mailto:${TO}@${DOMAIN}?subject=${subject}&body=${body}`;

    if (revealed) {
        return (
            <Tooltip title={t('tip.tooltip')}>
                <Button
                    size="small"
                    variant="outlined"
                    href={href}
                    startIcon={<TipsAndUpdatesOutlinedIcon fontSize="small" />}
                    sx={{ textTransform: 'none', ...sx }}
                >
                    {t('tip.send')}
                </Button>
            </Tooltip>
        );
    }

    return (
        <Tooltip title={t('tip.tooltip')}>
            <Button
                size="small"
                variant="text"
                onClick={() => setRevealed(true)}
                startIcon={<TipsAndUpdatesOutlinedIcon fontSize="small" />}
                sx={{ textTransform: 'none', color: 'text.secondary', ...sx }}
            >
                {t('tip.button')}
            </Button>
        </Tooltip>
    );
}

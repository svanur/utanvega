import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    TextField,
    useTheme,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_EMOJI } from '../constants/activityEmoji';
import {
    getActivityTheme,
    getDateLocale,
    drawRoundRect,
    wrapText,
    drawBackground,
    loadBrandImage,
} from '../utils/cardCanvas';

interface RaceShareCardProps {
    eventName: string;
    raceName: string;
    distanceLabel: string | null;
    date: string | null;
    daysUntil: number | null;
    activityType?: string;
    open?: boolean;
    onClose?: () => void;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

function renderCard(
    canvas: HTMLCanvasElement,
    props: RaceShareCardProps,
    bibNumber: string,
    customText: string,
    t: (key: string, opts?: Record<string, unknown>) => string,
    language: string,
    isDark: boolean,
    brandImage: HTMLImageElement | null,
) {
    const ctx = canvas.getContext('2d')!;
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    const theme = getActivityTheme(props.activityType, isDark);
    const W = CARD_WIDTH, H = CARD_HEIGHT;

    // Background gradient — diagonal
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, theme.bgFrom);
    bg.addColorStop(1, theme.bgTo);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow top-right
    const glow = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, W * 0.5);
    glow.addColorStop(0, `${theme.accent}18`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Activity-appropriate background silhouette
    drawBackground(ctx, W, H, theme.mountainColor, props.activityType);

    // Brand logo
    if (brandImage) {
        const imgSize = 88;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(brandImage, (W - imgSize) / 2, 44, imgSize, imgSize);
        ctx.globalAlpha = 1;
    }

    let y = brandImage ? 168 : 90;

    // Activity emoji
    const emoji = ACTIVITY_EMOJI[props.activityType ?? ''] ?? '🏃';
    ctx.font = '100px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, W / 2, y);
    y += 76;

    // Bib number — plain accent text directly under the emoji
    if (bibNumber) {
        ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.accent;
        ctx.fillText(`#${bibNumber}`, W / 2, y);
        y += 60;
    } else {
        y += 20;
    }

    // Race name — hero text
    ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = 'center';
    const nameLines = wrapText(ctx, props.raceName, W - 120);
    for (const line of nameLines) {
        y += 92;
        ctx.fillText(line, W / 2, y);
    }
    y += 20;

    // "I'm racing!" / "Race day!" badge
    y += 56;
    const badgeText = props.daysUntil === 0
        ? t('races.shareCard.racingToday', { defaultValue: "It's race day! 🏁" })
        : t('races.shareCard.racingSoon', { defaultValue: "I'm racing! 💥" });
    ctx.font = '700 54px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, W / 2, y);
    y += 16;

    // Distance — big and bold
    if (props.distanceLabel) {
        y += 72;
        ctx.font = '800 88px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.textColor;
        const distText = /\d/.test(props.distanceLabel) && !/km/i.test(props.distanceLabel)
            ? `${props.distanceLabel} km`
            : props.distanceLabel;
        ctx.fillText(distText, W / 2, y);
    }

    // Event name (if different from race name)
    if (props.eventName && props.eventName !== props.raceName) {
        y += 72;
        ctx.font = '44px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.subtextColor;
        const eventLines = wrapText(ctx, props.eventName, W - 160).slice(0, 2);
        for (let i = 0; i < eventLines.length; i++) {
            if (i > 0) y += 52;
            ctx.fillText(eventLines[i], W / 2, y);
        }
    }

    // Date
    if (props.date) {
        y += 64;
        ctx.font = '40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.subtextColor;
        const dateStr = new Date(props.date + 'T00:00:00').toLocaleDateString(getDateLocale(language), {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        ctx.fillText(dateStr, W / 2, y);
    }

    // Countdown
    if (props.daysUntil != null && props.daysUntil > 0) {
        y += 64;
        ctx.font = '700 46px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.accent;
        ctx.fillText(
            t('races.shareCard.countdown', { count: props.daysUntil, defaultValue: `${props.daysUntil} days to go!` }),
            W / 2, y,
        );
    }

    // Custom message — fixed position above branding, styled as a quote
    if (customText) {
        // Font must be set before wrapText so measureText uses the real metrics,
        // and the width budget leaves room for the quote marks added below.
        ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const lines = wrapText(ctx, customText, W - 260).slice(0, 2);
        lines[0] = `„${lines[0]}`;
        lines[lines.length - 1] = `${lines[lines.length - 1]}“`;
        ctx.fillStyle = isDark ? '#ffffff' : '#000000';
        ctx.textAlign = 'center';
        const startY = H - 136 - (lines.length > 1 ? 52 : 0);
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, startY + i * 52);
    }

    // Bottom branding
    ctx.font = '30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = isDark ? '#4a5568' : '#9ca3af';
    ctx.textAlign = 'center';
    ctx.fillText('hlaupadagskra.is', W / 2, H - 48);

    // Thin accent line under branding
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.5;
    drawRoundRect(ctx, W / 2 - 70, H - 30, 140, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

export default function RaceShareCard(props: RaceShareCardProps) {
    const { eventName, raceName, distanceLabel, date, daysUntil, activityType, open: openProp, onClose: onCloseProp } = props;
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [brandImage, setBrandImage] = useState<HTMLImageElement | null>(null);
    const [openInternal, setOpenInternal] = useState(false);
    const open = openProp !== undefined ? openProp : openInternal;
    const handleClose = () => { if (onCloseProp) { onCloseProp(); } else { setOpenInternal(false); } };
    const [bibNumber, setBibNumber] = useState('');
    const [customText, setCustomText] = useState('');
    const [rendered, setRendered] = useState(false);
    const [snackbar, setSnackbar] = useState('');
    const isDark = theme.palette.mode === 'dark';

    useEffect(() => {
        if (!open) return;
        loadBrandImage((img) => setBrandImage(img));
    }, [open]);

    useEffect(() => {
        if (!open) { setRendered(false); return; }
        const frame = requestAnimationFrame(() => {
            if (canvasRef.current) {
                renderCard(canvasRef.current, { eventName, raceName, distanceLabel, date, daysUntil, activityType }, bibNumber, customText, t, i18n.language, isDark, brandImage);
                setRendered(true);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [open, eventName, raceName, distanceLabel, date, daysUntil, activityType, bibNumber, customText, t, i18n.language, isDark, brandImage]);

    const getBlob = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (!canvasRef.current) { resolve(null); return; }
            canvasRef.current.toBlob(blob => resolve(blob), 'image/png');
        });
    }, []);

    const handleDownload = useCallback(async () => {
        const blob = await getBlob();
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${props.eventName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-race-card.png`;
        a.click();
        URL.revokeObjectURL(url);
        setSnackbar(t('races.shareCard.downloaded', { defaultValue: 'Image saved!' }));
    }, [getBlob, props.eventName, t]);

    const handleShare = useCallback(async () => {
        const blob = await getBlob();
        if (!blob) return;
        const file = new File([blob], 'race-card.png', { type: 'image/png' });
        if (typeof navigator.share !== 'undefined' && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    title: props.eventName,
                    text: t('races.shareCard.shareText', {
                        eventName: props.eventName,
                        defaultValue: `I'm racing ${props.eventName}! 💥`,
                    }),
                    files: [file],
                });
            } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') handleDownload();
            }
        } else {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setSnackbar(t('races.shareCard.copiedToClipboard', { defaultValue: 'Image copied to clipboard!' }));
            } catch {
                handleDownload();
            }
        }
    }, [getBlob, handleDownload, props.eventName, t]);

    return (
        <>
            {openProp === undefined && (
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<ShareIcon />}
                    onClick={() => setOpenInternal(true)}
                    sx={{ textTransform: 'none' }}
                >
                    {t('races.shareCard.button', { defaultValue: "I'm racing! 💥" })}
                </Button>
            )}

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
                >
                    <CloseIcon />
                </IconButton>
                <DialogContent sx={{ p: 2, pt: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 120 }}>
                        <TextField
                            label={t('races.shareCard.bibLabel', { defaultValue: 'Bib #' })}
                            value={bibNumber}
                            onChange={(e) => setBibNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            size="small"
                            fullWidth
                            placeholder="42"
                        />
                    </Box>
                    <TextField
                        label={t('races.shareCard.customTextLabel', { defaultValue: 'Your message' })}
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value.slice(0, 60))}
                        size="small"
                        fullWidth
                        sx={{ maxWidth: 400 }}
                        placeholder={t('races.shareCard.customTextPlaceholder', { defaultValue: 'Wish me luck! 🤞' })}
                        inputProps={{ maxLength: 60 }}
                    />
                    <canvas
                        ref={canvasRef}
                        style={{
                            width: '100%',
                            maxWidth: 400,
                            height: 'auto',
                            aspectRatio: '1',
                            borderRadius: 12,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', gap: 1, pb: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<ShareIcon />}
                        onClick={handleShare}
                        disabled={!rendered}
                        sx={{ textTransform: 'none' }}
                    >
                        {t('races.shareCard.share', { defaultValue: 'Share' })}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownload}
                        disabled={!rendered}
                        sx={{ textTransform: 'none' }}
                    >
                        {t('races.shareCard.download', { defaultValue: 'Save Image' })}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!snackbar}
                autoHideDuration={3000}
                onClose={() => setSnackbar('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar('')} severity="success" sx={{ width: '100%' }}>
                    {snackbar}
                </Alert>
            </Snackbar>
        </>
    );
}

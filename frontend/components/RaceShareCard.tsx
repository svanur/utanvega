import { useCallback, useRef, useState } from 'react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert,
    useTheme,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';

interface RaceShareCardProps {
    eventName: string;
    raceName: string;
    distanceLabel: string | null;
    date: string | null;
    daysUntil: number | null;
    activityType?: string;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

const ACTIVITY_EMOJI: Record<string, string> = {
    TrailRunning: '🏃‍♂️',
    Running: '🏃',
    Hiking: '🥾',
    Cycling: '🚴',
};

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function renderCard(
    canvas: HTMLCanvasElement,
    props: RaceShareCardProps,
    t: (key: string, opts?: Record<string, unknown>) => string,
    isDark: boolean,
) {
    const ctx = canvas.getContext('2d')!;
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    if (isDark) {
        bgGrad.addColorStop(0, '#1a1a2e');
        bgGrad.addColorStop(1, '#16213e');
    } else {
        bgGrad.addColorStop(0, '#f0f4ff');
        bgGrad.addColorStop(1, '#e8f5e9');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Decorative accent circle (top-right)
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(CARD_WIDTH - 100, 100, 300, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#90caf9' : '#1976d2';
    ctx.fill();
    ctx.globalAlpha = 1;

    const textColor = isDark ? '#ffffff' : '#1a1a1a';
    const subtextColor = isDark ? '#b0bec5' : '#546e7a';
    const accentColor = '#1976d2';

    const pad = 80;
    let y = 160;

    // Activity emoji (large)
    const emoji = ACTIVITY_EMOJI[props.activityType ?? ''] ?? '🏆';
    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, CARD_WIDTH / 2, y);
    y += 100;

    // Race name at the top
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    const nameLines = wrapText(ctx, props.raceName, CARD_WIDTH - pad * 2);
    for (const line of nameLines) {
        y += 80;
        ctx.fillText(line, CARD_WIDTH / 2, y);
    }
    y += 40;

    // "I'm racing!" badge
    const badgeText = props.daysUntil === 0
        ? t('races.shareCard.racingToday', { defaultValue: "It's race day!" })
        : t('races.shareCard.racingSoon', { defaultValue: "I'm racing!" });
    ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, CARD_WIDTH / 2, y + 60);
    y += 120;

    // Distance with "km" suffix
    if (props.distanceLabel) {
        y += 60;
        ctx.font = 'bold 80px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = textColor;
        const distText = /\d/.test(props.distanceLabel) && !/km/i.test(props.distanceLabel)
            ? `${props.distanceLabel} km`
            : props.distanceLabel;
        ctx.fillText(distText, CARD_WIDTH / 2, y);
    }

    // Event name (if different from race name)
    if (props.eventName && props.eventName !== props.raceName) {
        ctx.font = '44px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = subtextColor;
        y += 70;
        ctx.fillText(props.eventName, CARD_WIDTH / 2, y);
    }

    // Date
    if (props.date) {
        y += 70;
        ctx.font = '40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = subtextColor;
        const dateObj = new Date(props.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        ctx.fillText(dateStr, CARD_WIDTH / 2, y);
    }

    // Countdown
    if (props.daysUntil != null && props.daysUntil > 0) {
        y += 70;
        ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = accentColor;
        const countdownText = t('races.shareCard.countdown', {
            count: props.daysUntil,
            defaultValue: `${props.daysUntil} days to go!`,
        });
        ctx.fillText(countdownText, CARD_WIDTH / 2, y);
    }

    // Branding (bottom)
    ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = isDark ? '#607d8b' : '#90a4ae';
    ctx.textAlign = 'center';
    ctx.fillText('hlaupadagskra.is', CARD_WIDTH / 2, CARD_HEIGHT - 60);

    // Bottom accent line
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.6;
    drawRoundRect(ctx, CARD_WIDTH / 2 - 60, CARD_HEIGHT - 40, 120, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [text];
}

export default function RaceShareCard(props: RaceShareCardProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [open, setOpen] = useState(false);
    const [snackbar, setSnackbar] = useState('');
    const isDark = theme.palette.mode === 'dark';

    const generateCard = useCallback(() => {
        setOpen(true);
        // Render after dialog opens so canvas is in DOM
        setTimeout(() => {
            if (canvasRef.current) {
                renderCard(canvasRef.current, props, t, isDark);
            }
        }, 50);
    }, [props, t, isDark]);

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
                if (err instanceof Error && err.name !== 'AbortError') {
                    handleDownload();
                }
            }
        } else {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob }),
                ]);
                setSnackbar(t('races.shareCard.copiedToClipboard', { defaultValue: 'Image copied to clipboard!' }));
            } catch {
                handleDownload();
            }
        }
    }, [getBlob, handleDownload, props.eventName, t]);

    return (
        <>
            <Button
                variant="contained"
                color="secondary"
                startIcon={<ShareIcon />}
                onClick={generateCard}
                sx={{ textTransform: 'none' }}
            >
                {t('races.shareCard.button', { defaultValue: "I'm racing! 💥" })}
            </Button>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <IconButton
                    aria-label="close"
                    onClick={() => setOpen(false)}
                    sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
                >
                    <CloseIcon />
                </IconButton>
                <DialogContent sx={{ p: 2, pt: 5, display: 'flex', justifyContent: 'center' }}>
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
                        sx={{ textTransform: 'none' }}
                    >
                        {t('races.shareCard.share', { defaultValue: 'Share' })}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownload}
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

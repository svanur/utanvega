import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogActions,
    DialogTitle,
    Snackbar,
    Alert,
    useTheme,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_EMOJI } from '../constants/activityEmoji';
import TimePickerInput from './TimePickerInput';

interface RaceFinishCardProps {
    eventName: string;
    raceName: string;
    distanceLabel: string | null;
    date: string | null;
    activityType?: string;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

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

function renderFinishCard(
    canvas: HTMLCanvasElement,
    props: RaceFinishCardProps,
    finishTime: string,
    t: (key: string, opts?: Record<string, unknown>) => string,
    isDark: boolean,
) {
    const ctx = canvas.getContext('2d')!;
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    // Background gradient - celebratory gold/warm tones
    const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    if (isDark) {
        bgGrad.addColorStop(0, '#1a1a2e');
        bgGrad.addColorStop(0.5, '#2d1b4e');
        bgGrad.addColorStop(1, '#1a2e1a');
    } else {
        bgGrad.addColorStop(0, '#fff8e1');
        bgGrad.addColorStop(0.5, '#fff3e0');
        bgGrad.addColorStop(1, '#e8f5e9');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Decorative accent circles
    ctx.globalAlpha = 0.06;
    ctx.beginPath();
    ctx.arc(150, 900, 250, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#ffd54f' : '#ff9800';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CARD_WIDTH - 100, 150, 200, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#66bb6a' : '#4caf50';
    ctx.fill();
    ctx.globalAlpha = 1;

    const textColor = isDark ? '#ffffff' : '#1a1a1a';
    const subtextColor = isDark ? '#b0bec5' : '#546e7a';
    const goldColor = '#f9a825';
    const accentColor = isDark ? '#ffd54f' : '#e65100';

    const pad = 80;
    let y = 140;

    // Trophy + activity emoji
    const emoji = ACTIVITY_EMOJI[props.activityType ?? ''] ?? '🏆';
    ctx.font = '100px serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🏁 ${emoji} 🏁`, CARD_WIDTH / 2, y);
    y += 90;

    // "I finished!" header
    const headerText = t('races.finishCard.finished', { defaultValue: 'I finished!' });
    ctx.font = 'bold 60px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'center';
    ctx.fillText(headerText, CARD_WIDTH / 2, y + 60);
    y += 130;

    // Race name
    ctx.font = 'bold 58px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    const nameLines = wrapText(ctx, props.raceName, CARD_WIDTH - pad * 2);
    for (const line of nameLines) {
        y += 72;
        ctx.fillText(line, CARD_WIDTH / 2, y);
    }
    y += 30;

    // Distance
    if (props.distanceLabel) {
        y += 55;
        ctx.font = '48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = subtextColor;
        const distText = /\d/.test(props.distanceLabel) && !/km/i.test(props.distanceLabel)
            ? `${props.distanceLabel} km`
            : props.distanceLabel;
        ctx.fillText(distText, CARD_WIDTH / 2, y);
    }

    // Finish time (the star of the show)
    const hasTime = finishTime && finishTime !== '00:00:00';
    if (hasTime) {
        y += 90;
        // Gold badge background
        const timeWidth = 500;
        const timeHeight = 110;
        const timeX = (CARD_WIDTH - timeWidth) / 2;
        ctx.fillStyle = isDark ? 'rgba(255, 213, 79, 0.15)' : 'rgba(249, 168, 37, 0.12)';
        drawRoundRect(ctx, timeX, y - 75, timeWidth, timeHeight, 20);
        ctx.fill();
        ctx.strokeStyle = goldColor;
        ctx.lineWidth = 3;
        drawRoundRect(ctx, timeX, y - 75, timeWidth, timeHeight, 20);
        ctx.stroke();

        ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = goldColor;
        ctx.textAlign = 'center';
        ctx.fillText(`⏱️ ${finishTime}`, CARD_WIDTH / 2, y);
    }

    // Event name (subtitle if different)
    if (props.eventName && props.eventName !== props.raceName) {
        y += 80;
        ctx.font = '38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = subtextColor;
        ctx.fillText(props.eventName, CARD_WIDTH / 2, y);
    }

    // Date
    if (props.date) {
        y += 60;
        ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = subtextColor;
        const dateObj = new Date(props.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        ctx.fillText(dateStr, CARD_WIDTH / 2, y);
    }

    // Branding (bottom)
    ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = isDark ? '#607d8b' : '#90a4ae';
    ctx.textAlign = 'center';
    ctx.fillText('utanvega.is', CARD_WIDTH / 2, CARD_HEIGHT - 60);

    // Bottom accent line
    ctx.fillStyle = goldColor;
    ctx.globalAlpha = 0.6;
    drawRoundRect(ctx, CARD_WIDTH / 2 - 60, CARD_HEIGHT - 40, 120, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

export default function RaceFinishCard(props: RaceFinishCardProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [open, setOpen] = useState(false);
    const [finishTime, setFinishTime] = useState('');
    const [rendered, setRendered] = useState(false);
    const [snackbar, setSnackbar] = useState('');
    const isDark = theme.palette.mode === 'dark';

    useEffect(() => {
        if (!open) { setRendered(false); return; }
        const frame = requestAnimationFrame(() => {
            if (canvasRef.current) {
                renderFinishCard(canvasRef.current, props, finishTime, t, isDark);
                setRendered(true);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [open, props, finishTime, t, isDark]);

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
        a.download = `${props.eventName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-finish-card.png`;
        a.click();
        URL.revokeObjectURL(url);
        setSnackbar(t('races.finishCard.downloaded', { defaultValue: 'Image saved!' }));
    }, [getBlob, props.eventName, t]);

    const handleShare = useCallback(async () => {
        const blob = await getBlob();
        if (!blob) return;

        const file = new File([blob], 'finish-card.png', { type: 'image/png' });

        if (typeof navigator.share !== 'undefined' && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    title: props.raceName,
                    text: t('races.finishCard.shareText', {
                        raceName: props.raceName,
                        time: finishTime && finishTime !== '00:00:00' ? finishTime : '',
                        defaultValue: `I finished ${props.raceName}${finishTime && finishTime !== '00:00:00' ? ` in ${finishTime}` : ''}! 🏁`,
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
                setSnackbar(t('races.finishCard.copiedToClipboard', { defaultValue: 'Image copied to clipboard!' }));
            } catch {
                handleDownload();
            }
        }
    }, [getBlob, handleDownload, props.raceName, finishTime, t]);

    return (
        <>
            <Button
                variant="contained"
                color="success"
                startIcon={<EmojiEventsIcon />}
                onClick={() => setOpen(true)}
                sx={{ textTransform: 'none' }}
            >
                {t('races.finishCard.button', { defaultValue: 'I finished! 🏁' })}
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
                <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
                    {t('races.finishCard.title', { defaultValue: 'Share your result!' })}
                </DialogTitle>
                <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: '100%', maxWidth: 260, mt: 1 }}>
                        <TimePickerInput
                            value={finishTime || '00:00:00'}
                            onChange={setFinishTime}
                            label={t('races.finishCard.timeLabel', { defaultValue: 'Finish time' })}
                            helperText=""
                        />
                    </Box>
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
                        {t('races.finishCard.share', { defaultValue: 'Share' })}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownload}
                        disabled={!rendered}
                        sx={{ textTransform: 'none' }}
                    >
                        {t('races.finishCard.download', { defaultValue: 'Save Image' })}
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

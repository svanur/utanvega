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
    Stack,
    TextField,
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
import {
    getActivityTheme,
    getDateLocale,
    drawRoundRect,
    wrapText,
    drawBackground,
    loadBrandImage,
} from '../utils/cardCanvas';

interface RaceFinishCardProps {
    eventName: string;
    raceName: string;
    distanceLabel: string | null;
    date: string | null;
    activityType?: string;
    open?: boolean;
    onClose?: () => void;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

function renderFinishCard(
    canvas: HTMLCanvasElement,
    props: RaceFinishCardProps,
    finishTime: string,
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

    // Subtle radial glow top-left
    const glow = ctx.createRadialGradient(W * 0.15, H * 0.15, 0, W * 0.15, H * 0.15, W * 0.5);
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

    // Extra gap so emoji doesn't overlap the logo (logo ends at ~132px)
    let y = brandImage ? 210 : 90;

    // Activity emoji
    const emoji = ACTIVITY_EMOJI[props.activityType ?? ''] ?? '🏆';
    ctx.font = '80px serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🏁 ${emoji} 🏁`, W / 2, y);
    y += 68;

    // Bib number — plain accent text directly under the emoji
    if (bibNumber) {
        ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.accent;
        ctx.fillText(`#${bibNumber}`, W / 2, y);
        y += 60;
    } else {
        y += 20;
    }

    // "I finished!"
    ctx.font = '700 50px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.fillText(t('races.finishCard.finished', { defaultValue: 'I finished!' }), W / 2, y);
    y += 90;

    // 1. Event name
    if (props.eventName) {
        ctx.font = '40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.subtextColor;
        ctx.fillText(props.eventName, W / 2, y);
        y += 86;
    }

    // 2. Race name — hero
    ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = 'center';
    const nameLines = wrapText(ctx, props.raceName, W - 120);
    for (const line of nameLines) {
        ctx.fillText(line, W / 2, y);
        y += 90;
    }

    // 3. Finish time badge
    y -= 22;
    const hasTime = finishTime && finishTime !== '00:00:00';
    if (hasTime) {
        const bw = 540, bh = 112, bx = (W - bw) / 2;
        ctx.fillStyle = theme.badgeBg;
        drawRoundRect(ctx, bx, y, bw, bh, 20);
        ctx.fill();
        ctx.strokeStyle = theme.badgeBorder;
        ctx.lineWidth = 3;
        drawRoundRect(ctx, bx, y, bw, bh, 20);
        ctx.stroke();
        ctx.font = 'bold 68px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.accent;
        ctx.textAlign = 'center';
        ctx.fillText(`⏱️ ${finishTime}`, W / 2, y + 78);
        y += bh + 72;
    }

    // 4. Distance label
    if (props.distanceLabel) {
        ctx.font = '46px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.subtextColor;
        const distText = /\d/.test(props.distanceLabel) && !/km/i.test(props.distanceLabel)
            ? `${props.distanceLabel} km`
            : props.distanceLabel;
        ctx.fillText(distText, W / 2, y);
        y += 60;
    }

    // 5. Date
    if (props.date) {
        y += -9;
        ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = theme.subtextColor;
        const dateStr = new Date(props.date + 'T00:00:00').toLocaleDateString(getDateLocale(language), {
            day: 'numeric', month: 'long', year: 'numeric',
        });
        ctx.fillText(dateStr, W / 2, y);
    }

    // Custom message — fixed position above branding, styled as a quote
    if (customText) {
        const lines = wrapText(ctx, customText, W - 200).slice(0, 2);
        lines[0] = `„${lines[0]}`;
        lines[lines.length - 1] = `${lines[lines.length - 1]}“`;
        ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        const startY = H - 156 - (lines.length > 1 ? 52 : 0);
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, startY + i * 52);
    }

    // Bottom branding
    ctx.font = '30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = isDark ? '#4a5568' : '#9ca3af';
    ctx.textAlign = 'center';
    ctx.fillText('hlaupadagskra.is', W / 2, H - 90);

    // Thin accent line under branding
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.5;
    drawRoundRect(ctx, W / 2 - 70, H - 78, 140, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

export default function RaceFinishCard(props: RaceFinishCardProps) {
    const { eventName, raceName, distanceLabel, date, activityType, open: openProp, onClose: onCloseProp } = props;
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [brandImage, setBrandImage] = useState<HTMLImageElement | null>(null);
    const [openInternal, setOpenInternal] = useState(false);
    const open = openProp !== undefined ? openProp : openInternal;
    const handleClose = () => { onCloseProp ? onCloseProp() : setOpenInternal(false); };
    const [finishTime, setFinishTime] = useState('');
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
                renderFinishCard(canvasRef.current, { eventName, raceName, distanceLabel, date, activityType }, finishTime, bibNumber, customText, t, i18n.language, isDark, brandImage);
                setRendered(true);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [open, eventName, raceName, distanceLabel, date, activityType, finishTime, bibNumber, customText, t, i18n.language, isDark, brandImage]);

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
                const hasTime = finishTime && finishTime !== '00:00:00';
                const shareText = hasTime
                    ? t('races.finishCard.shareText', { raceName: props.raceName, time: finishTime })
                    : t('races.finishCard.shareTextNoTime', { raceName: props.raceName });
                await navigator.share({ title: props.raceName, text: shareText, files: [file] });
            } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') handleDownload();
            }
        } else {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setSnackbar(t('races.finishCard.copiedToClipboard', { defaultValue: 'Image copied to clipboard!' }));
            } catch {
                handleDownload();
            }
        }
    }, [getBlob, handleDownload, props.raceName, finishTime, t]);

    return (
        <>
            {openProp === undefined && (
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<EmojiEventsIcon />}
                    onClick={() => setOpenInternal(true)}
                    sx={{ textTransform: 'none' }}
                >
                    {t('races.finishCard.button', { defaultValue: 'I finished! 🏁' })}
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
                <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
                    {t('races.finishCard.title', { defaultValue: 'Share your result!' })}
                </DialogTitle>
                <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Stack direction="row" spacing={2} sx={{ width: '100%', maxWidth: 400, mt: 1 }}>
                        <Box sx={{ flex: 1 }}>
                            <TimePickerInput
                                value={finishTime || '00:00:00'}
                                onChange={setFinishTime}
                                label={t('races.finishCard.timeLabel', { defaultValue: 'Finish time' })}
                                helperText=""
                            />
                        </Box>
                        <Box sx={{ width: 120 }}>
                            <TextField
                                label={t('races.finishCard.bibLabel', { defaultValue: 'Bib #' })}
                                value={bibNumber}
                                onChange={(e) => setBibNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                size="small"
                                fullWidth
                                placeholder="261"
                            />
                        </Box>
                    </Stack>
                    <TextField
                        label={t('races.finishCard.customTextLabel', { defaultValue: 'Your message' })}
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value.slice(0, 60))}
                        size="small"
                        fullWidth
                        sx={{ maxWidth: 400 }}
                        placeholder={t('races.finishCard.customTextPlaceholder', { defaultValue: 'That was fun! ❄️' })}
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

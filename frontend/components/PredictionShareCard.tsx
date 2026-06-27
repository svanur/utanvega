import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogActions, Snackbar, Alert, useTheme } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';

interface PredictionShareCardProps {
    trailAName: string;
    trailBName: string;
    knownTime: string;
    predictedTime: string;
    predictedPace: string;
    distanceKm: number;
    elevationGain: number;
    elevationLoss: number;
    open: boolean;
    onClose: () => void;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1080;

let cachedBrandImage: HTMLImageElement | null = null;
let brandImageLoading = false;
const brandImageCallbacks: Array<(img: HTMLImageElement) => void> = [];

function loadBrandImage(onLoad: (img: HTMLImageElement) => void) {
    if (cachedBrandImage) { onLoad(cachedBrandImage); return; }
    brandImageCallbacks.push(onLoad);
    if (brandImageLoading) return;
    brandImageLoading = true;
    const img = new Image();
    img.src = '/images/hlaupadagskra.avif';
    img.onload = () => {
        cachedBrandImage = img;
        for (const cb of brandImageCallbacks) cb(img);
        brandImageCallbacks.length = 0;
    };
}

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

function measureHeight(
    ctx: CanvasRenderingContext2D,
    props: PredictionShareCardProps,
    hasBrandImage: boolean,
    basedOnText: string,
): number {
    let y = 60;
    if (hasBrandImage) y += 124;
    y += 48; // label
    ctx.font = 'bold 60px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const nameLines = wrapText(ctx, props.trailBName, CARD_WIDTH - 160);
    y += nameLines.length * 66 + 24;
    y += 130; // time
    y += 72;  // pace
    y += 30 + 110 + 30; // stats gap + box + gap
    ctx.font = '30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const basedOnLines = wrapText(ctx, basedOnText, CARD_WIDTH - 160);
    y += basedOnLines.length * 38;
    y += 48 + 26 + 20; // branding gap + text + accent bar + bottom padding
    return y;
}

function renderCard(
    canvas: HTMLCanvasElement,
    props: PredictionShareCardProps,
    isDark: boolean,
    brandImage: HTMLImageElement | null,
    label: string,
    basedOnText: string,
    distanceLabel: string,
    elevationLabel: string,
    elevationLossLabel: string,
) {
    const ctx = canvas.getContext('2d')!;
    canvas.width = CARD_WIDTH;
    // Measure content height first, then size canvas to fit
    canvas.height = measureHeight(ctx, props, !!brandImage, basedOnText);

    const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, canvas.height);
    if (isDark) {
        bgGrad.addColorStop(0, '#0d1b2a');
        bgGrad.addColorStop(1, '#1b2838');
    } else {
        bgGrad.addColorStop(0, '#f0f4ff');
        bgGrad.addColorStop(1, '#e8f0fe');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Decorative accent circle
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.arc(CARD_WIDTH - 80, 120, 260, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#90caf9' : '#1976d2';
    ctx.fill();
    ctx.globalAlpha = 1;

    const textColor = isDark ? '#ffffff' : '#1a1a1a';
    const subtextColor = isDark ? '#b0bec5' : '#546e7a';
    const accentColor = '#1976d2';
    const pad = 80;

    // Brand image
    let y = 60;
    if (brandImage) {
        const imgSize = 90;
        ctx.drawImage(brandImage, (CARD_WIDTH - imgSize) / 2, y, imgSize, imgSize);
        y += 124;
    }

    // Label
    ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = subtextColor;
    ctx.textAlign = 'center';
    ctx.fillText(label, CARD_WIDTH / 2, y);
    y += 48;

    // Trail B name
    ctx.font = 'bold 60px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = textColor;
    const nameLines = wrapText(ctx, props.trailBName, CARD_WIDTH - pad * 2);
    for (const line of nameLines) {
        y += 66;
        ctx.fillText(line, CARD_WIDTH / 2, y);
    }
    y += 24;

    // Big predicted time
    ctx.font = 'bold 128px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText(props.predictedTime, CARD_WIDTH / 2, y + 110);
    y += 130;

    // Pace
    ctx.font = '38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = subtextColor;
    ctx.fillText(`${props.predictedPace}/km`, CARD_WIDTH / 2, y + 44);
    y += 72;

    // Stats row
    const statsY = y + 30;
    const statBoxW = 300;
    const statBoxH = 110;
    const statGap = 20;
    const totalW = statBoxW * 3 + statGap * 2;
    const startX = (CARD_WIDTH - totalW) / 2;

    const drawStatBox = (bx: number, statLabel: string, value: string) => {
        ctx.globalAlpha = isDark ? 0.15 : 0.08;
        drawRoundRect(ctx, bx, statsY, statBoxW, statBoxH, 16);
        ctx.fillStyle = isDark ? '#ffffff' : '#000000';
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(value, bx + statBoxW / 2, statsY + 62);

        ctx.font = '26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = subtextColor;
        ctx.fillText(statLabel, bx + statBoxW / 2, statsY + 94);
    };

    drawStatBox(startX, distanceLabel, `${props.distanceKm.toFixed(1)} km`);
    drawStatBox(startX + statBoxW + statGap, elevationLabel, `+${Math.round(props.elevationGain)}m`);
    drawStatBox(startX + (statBoxW + statGap) * 2, elevationLossLabel, `-${Math.round(props.elevationLoss)}m`);
    y = statsY + statBoxH + 30;

    // "Based on" line — wrapped
    ctx.font = '30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = subtextColor;
    ctx.textAlign = 'center';
    const basedOnLines = wrapText(ctx, basedOnText, CARD_WIDTH - 160);
    for (const line of basedOnLines) {
        y += 38;
        ctx.fillText(line, CARD_WIDTH / 2, y);
    }

    // Branding — follows content, not pinned to bottom
    y += 48;
    ctx.font = '26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = isDark ? '#607d8b' : '#90a4ae';
    ctx.fillText('hlaupadagskra.is', CARD_WIDTH / 2, y);

    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.6;
    drawRoundRect(ctx, CARD_WIDTH / 2 - 60, y + 16, 120, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

export default function PredictionShareCard(props: PredictionShareCardProps) {
    const { open, onClose, trailBName } = props;
    const { t } = useTranslation();
    const theme = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [brandImage, setBrandImage] = useState<HTMLImageElement | null>(null);
    const [rendered, setRendered] = useState(false);
    const [snackbar, setSnackbar] = useState('');
    const isDark = theme.palette.mode === 'dark';

    useEffect(() => {
        if (!open) return;
        loadBrandImage((img) => setBrandImage(img));
    }, [open]);

    const label = t('tools.trailPredictor.shareCardLabel');
    const basedOnText = t('tools.trailPredictor.shareCardBasedOn', { time: props.knownTime, trail: props.trailAName });
    const distanceLabel = t('compare.distance');
    const elevationLabel = t('compare.elevationGain');
    const elevationLossLabel = t('compare.elevationLoss');

    useEffect(() => {
        if (!open) { setRendered(false); return; }
        const frame = requestAnimationFrame(() => {
            if (canvasRef.current) {
                renderCard(canvasRef.current, props, isDark, brandImage, label, basedOnText, distanceLabel, elevationLabel, elevationLossLabel);
                setRendered(true);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [open, props, isDark, brandImage, label, basedOnText, distanceLabel, elevationLabel, elevationLossLabel]);

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
        a.download = `${trailBName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-prediction.png`;
        a.click();
        URL.revokeObjectURL(url);
        setSnackbar(t('races.shareCard.downloaded', { defaultValue: 'Image saved!' }));
    }, [getBlob, trailBName, t]);

    const handleShare = useCallback(async () => {
        const blob = await getBlob();
        if (!blob) return;
        const file = new File([blob], 'prediction.png', { type: 'image/png' });
        if (typeof navigator.share !== 'undefined' && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    title: trailBName,
                    text: t('tools.trailPredictor.shareText', {
                        trail: props.trailBName,
                        time: props.predictedTime,
                        fromTrail: props.trailAName,
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
    }, [getBlob, handleDownload, trailBName, t]);

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
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
                    <Button variant="contained" startIcon={<ShareIcon />} onClick={handleShare} disabled={!rendered} sx={{ textTransform: 'none' }}>
                        {t('races.shareCard.share', { defaultValue: 'Share' })}
                    </Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload} disabled={!rendered} sx={{ textTransform: 'none' }}>
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

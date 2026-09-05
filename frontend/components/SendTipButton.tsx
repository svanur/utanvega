import { useState, useRef } from 'react';
import {
    Box, Button, CircularProgress, Collapse, IconButton, TextField, Tooltip,
    Typography, Divider, MenuItem, Select, FormControl, InputLabel, Chip,
    ToggleButton, ToggleButtonGroup, LinearProgress,
} from '@mui/material';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTranslation } from 'react-i18next';
import type { SxProps, Theme } from '@mui/material';
import { API_URL } from '../hooks/useTrails';

interface SendTipButtonProps {
    type: 'trail' | 'event';
    sx?: SxProps<Theme>;
    inline?: boolean; // skip the toggle button, start open in detailed mode
}

type Mode = 'simple' | 'detailed';
type Category = 'bug' | 'suggestion' | 'question' | 'other';

function collectBrowserInfo(): string {
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
    return JSON.stringify({
        userAgent: nav.userAgent,
        language: nav.language,
        platform: nav.platform,
        screenW: screen.width,
        screenH: screen.height,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        isMobile: /Mobi|Android/i.test(nav.userAgent),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        online: nav.onLine,
        connection: nav.connection?.effectiveType ?? null,
        pageTitle: document.title,
    });
}

async function captureScreenshot(): Promise<string | null> {
    try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(document.body, {
            scale: 0.5,
            useCORS: true,
            logging: false,
            allowTaint: true,
        });
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch {
        return null;
    }
}

// `type` is accepted (and passed distinctly as 'trail'/'event' by every call site) but not yet
// forwarded anywhere below — neither /api/v1/tips nor /api/v1/feedback receives it today. Left
// wired into the props contract rather than deleted; see PR #570 notes before removing it.
export default function SendTipButton({ type: _type, sx, inline = false }: SendTipButtonProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(inline);
    const [mode, setMode] = useState<Mode>(inline ? 'detailed' : 'simple');
    const [message, setMessage] = useState('');
    const [category, setCategory] = useState<Category>('bug');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [steps, setSteps] = useState('');
    const [status, setStatus] = useState<'idle' | 'capturing' | 'sending' | 'sent' | 'error'>('idle');
    const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
    const [includeScreenshot, setIncludeScreenshot] = useState(false);
    const screenshotTakenRef = useRef(false);

    // Auto-capture when switching to detailed mode (before user sees the form)
    async function switchToDetailed() {
        if (mode === 'detailed') return;
        setMode('detailed');
        if (!screenshotTakenRef.current) {
            screenshotTakenRef.current = true;
            setStatus('capturing');
            const dataUrl = await captureScreenshot();
            setScreenshotDataUrl(dataUrl);
            setIncludeScreenshot(!!dataUrl);
            setStatus('idle');
        }
    }

    async function handleSend() {
        if (!message.trim()) return;
        setStatus('sending');

        const isDetailed = mode === 'detailed';
        const browserInfo = isDetailed ? collectBrowserInfo() : null;

        // Upload screenshot as base64 inline (small, jpeg 0.7 @ 0.5 scale)
        const screenshotPayload = (isDetailed && includeScreenshot && screenshotDataUrl)
            ? screenshotDataUrl
            : null;

        try {
            const endpoint = isDetailed ? '/api/v1/feedback' : '/api/v1/tips';
            const body = isDetailed
                ? JSON.stringify({
                    pageUrl: window.location.href,
                    message: message.trim(),
                    category,
                    name: name.trim() || null,
                    email: email.trim() || null,
                    stepsToReproduce: steps.trim() || null,
                    browserInfo,
                    screenshotUrl: screenshotPayload,
                })
                : JSON.stringify({ pageUrl: window.location.href, message: message.trim() });

            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (!res.ok) throw new Error();
            setStatus('sent');
            setMessage('');
        } catch {
            setStatus('error');
        }
    }

    function handleClose() {
        setOpen(false);
        setMessage('');
        setName('');
        setEmail('');
        setSteps('');
        setStatus('idle');
        setMode('simple');
        setScreenshotDataUrl(null);
        setIncludeScreenshot(false);
        screenshotTakenRef.current = false;
    }

    return (
        <Box sx={{ width: '100%', ...sx }}>
            {!inline && (
                <Tooltip title={t('tip.tooltip')}>
                    <Button
                        size="small"
                        variant="text"
                        onClick={() => setOpen(o => !o)}
                        startIcon={<TipsAndUpdatesOutlinedIcon fontSize="small" />}
                        sx={{ textTransform: 'none', color: 'text.secondary' }}
                    >
                        {t('tip.button')}
                    </Button>
                </Tooltip>
            )}

            <Collapse in={open}>
                <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                    {status === 'sent' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CheckCircleOutlineIcon color="success" fontSize="small" />
                                <Typography variant="body2" color="success.main">{t('tip.sent')}</Typography>
                            </Box>
                            <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
                        </Box>
                    ) : (
                        <>
                            {/* Mode toggle */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <ToggleButtonGroup
                                    value={mode}
                                    exclusive
                                    size="small"
                                    onChange={(_, v) => { if (v === 'detailed') void switchToDetailed(); else setMode('simple'); }}
                                >
                                    <ToggleButton value="simple" sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}>
                                        {t('tip.modeSimple')}
                                    </ToggleButton>
                                    <ToggleButton value="detailed" sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}>
                                        <ExpandMoreIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                        {t('tip.modeDetailed')}
                                    </ToggleButton>
                                </ToggleButtonGroup>
                                {!inline && <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>}
                            </Box>

                            {status === 'capturing' && (
                                <Box sx={{ mb: 1 }}>
                                    <LinearProgress sx={{ borderRadius: 1 }} />
                                    <Typography variant="caption" color="text.secondary">{t('tip.capturingScreen')}</Typography>
                                </Box>
                            )}

                            {/* Detailed-only fields */}
                            {mode === 'detailed' && (
                                <>
                                    <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                                        <InputLabel>{t('tip.category')}</InputLabel>
                                        <Select
                                            value={category}
                                            label={t('tip.category')}
                                            onChange={e => setCategory(e.target.value as Category)}
                                        >
                                            <MenuItem value="bug">{t('tip.categoryBug')}</MenuItem>
                                            <MenuItem value="suggestion">{t('tip.categorySuggestion')}</MenuItem>
                                            <MenuItem value="question">{t('tip.categoryQuestion')}</MenuItem>
                                            <MenuItem value="other">{t('tip.categoryOther')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                                        <TextField size="small" label={t('tip.name')} value={name}
                                            onChange={e => setName(e.target.value)} inputProps={{ maxLength: 200 }} />
                                        <TextField size="small" label={t('tip.email')} type="email" value={email}
                                            onChange={e => setEmail(e.target.value)} inputProps={{ maxLength: 200 }} />
                                    </Box>
                                </>
                            )}

                            <TextField
                                fullWidth multiline minRows={2} maxRows={5} size="small"
                                placeholder={t('tip.placeholder')}
                                value={message}
                                onChange={e => { setMessage(e.target.value); setStatus('idle'); }}
                                disabled={status === 'sending'}
                                inputProps={{ maxLength: 2000 }}
                                sx={{ mb: 1 }}
                            />

                            {mode === 'detailed' && (
                                <>
                                    <TextField
                                        fullWidth multiline minRows={2} maxRows={4} size="small"
                                        label={t('tip.stepsToReproduce')}
                                        placeholder={t('tip.stepsPlaceholder')}
                                        value={steps}
                                        onChange={e => setSteps(e.target.value)}
                                        disabled={status === 'sending'}
                                        inputProps={{ maxLength: 2000 }}
                                        sx={{ mb: 1 }}
                                    />

                                    {/* Screenshot preview / toggle */}
                                    {screenshotDataUrl && (
                                        <Box sx={{ mb: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <CameraAltOutlinedIcon fontSize="small" color="action" />
                                                <Typography variant="caption" color="text.secondary">{t('tip.screenshot')}</Typography>
                                                <Chip
                                                    size="small"
                                                    label={includeScreenshot ? t('tip.screenshotInclude') : t('tip.screenshotExclude')}
                                                    color={includeScreenshot ? 'primary' : 'default'}
                                                    variant={includeScreenshot ? 'filled' : 'outlined'}
                                                    onClick={() => setIncludeScreenshot(v => !v)}
                                                    sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
                                                />
                                            </Box>
                                            {includeScreenshot && (
                                                <Box
                                                    component="img"
                                                    src={screenshotDataUrl}
                                                    alt="screenshot"
                                                    sx={{ width: '100%', borderRadius: 1, border: 1, borderColor: 'divider', maxHeight: 120, objectFit: 'cover', objectPosition: 'top' }}
                                                />
                                            )}
                                        </Box>
                                    )}

                                    <Divider sx={{ mb: 1 }} />
                                    <Typography variant="caption" color="text.disabled">
                                        {t('tip.autoCapture', {
                                            items: ['browser', 'OS', 'screen size', 'language', 'timezone'].join(', ')
                                        })}
                                    </Typography>
                                </>
                            )}

                            {status === 'error' && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                                    {t('tip.error')}
                                </Typography>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                                <Button
                                    size="small" variant="contained"
                                    onClick={handleSend}
                                    disabled={!message.trim() || status === 'sending' || status === 'capturing'}
                                    startIcon={status === 'sending' ? <CircularProgress size={14} /> : undefined}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {t('tip.send')}
                                </Button>
                            </Box>
                        </>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}

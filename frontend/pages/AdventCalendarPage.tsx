import { useCallback, useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Dialog, DialogTitle, DialogContent,
    IconButton, Stack, TextField, CircularProgress, Tabs, Tab, Link as MuiLink, List, ListItem,
    ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import CheckIcon from '@mui/icons-material/Check';
import ShareIcon from '@mui/icons-material/Share';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import Layout from '../components/Layout';
import { usePageTitle } from '../hooks/usePageTitle';
import { API_URL } from '../hooks/useTrails';
import { useAdventCalendar, isDoorUnlocked } from '../hooks/useAdventCalendar';

interface AdventCalendarPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

/** The shape `GET /api/v1/advent/{day}` returns — mirrors `AdventQuestionDto`
 *  (`backend/Application/Advent/AdventQuestionDto.cs`). Deliberately has no `correctIndex`:
 *  the server never sends it, so there is nothing here for this page to accidentally reveal. */
interface AdventQuestionDto {
    day: number;
    textIs: string;
    textEn: string;
    choicesIs: string[];
    choicesEn: string[];
    linkUrl: string;
    linkLabelIs: string;
    linkLabelEn: string;
}

// Same quick client-side pre-check as NewsletterPage.tsx:20 — the backend's
// System.Net.Mail.MailAddress check remains the real authority.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DOOR_COUNT = 24;

type AnswerState = 'idle' | 'submitting';

export default function AdventCalendarPage({ mode, onToggleMode }: AdventCalendarPageProps) {
    const { t, i18n } = useTranslation();
    usePageTitle(t('advent.pageTitle'));
    const isIcelandic = i18n.language.startsWith('is');

    const { email, setEmail, clearEmail, markWon, hasWon } = useAdventCalendar();

    const [tab, setTab] = useState<'calendar' | 'rules'>('calendar');
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [questions, setQuestions] = useState<Record<number, AdventQuestionDto | null>>({});
    const [loadingDay, setLoadingDay] = useState<number | null>(null);
    // Wrong picks are intentionally in-memory only (not persisted): #1876 AC says a wrong answer
    // disables just that choice with no lockout, but only a *correct* answer survives a reload.
    const [wrongChoices, setWrongChoices] = useState<Record<number, Set<number>>>({});
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [emailDraft, setEmailDraft] = useState('');
    const [emailError, setEmailError] = useState(false);

    const fetchQuestion = useCallback(async (day: number) => {
        setLoadingDay(day);
        try {
            const res = await fetch(`${API_URL}/api/v1/advent/${day}`);
            const dto: AdventQuestionDto | null = res.ok ? await res.json() : null;
            setQuestions(prev => ({ ...prev, [day]: dto }));
        } catch {
            setQuestions(prev => ({ ...prev, [day]: null }));
        } finally {
            setLoadingDay(null);
        }
    }, []);

    const handleDoorClick = (day: number) => {
        if (!isDoorUnlocked(day)) return;
        setSelectedDay(day);
        setEmailDraft(email ?? '');
        setEmailError(false);
        if (!(day in questions)) {
            void fetchQuestion(day);
        }
    };

    const handleCloseDialog = () => {
        setSelectedDay(null);
        setEmailError(false);
    };

    const resolveEmail = (): string | null => {
        if (email) return email;
        const trimmed = emailDraft.trim();
        if (!EMAIL_PATTERN.test(trimmed)) {
            setEmailError(true);
            return null;
        }
        setEmail(trimmed);
        return trimmed;
    };

    const handleChoice = async (day: number, index: number) => {
        if (hasWon(day) || answerState === 'submitting') return;
        if (wrongChoices[day]?.has(index)) return;

        const resolvedEmail = resolveEmail();
        if (!resolvedEmail) return;

        setAnswerState('submitting');
        try {
            const res = await fetch(`${API_URL}/api/v1/advent/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day, selectedIndex: index, email: resolvedEmail }),
            });
            if (!res.ok) return; // day locked or email rejected server-side — leave the UI as-is
            const result: { isCorrect: boolean } = await res.json();
            if (result.isCorrect) {
                markWon(day);
            } else {
                setWrongChoices(prev => {
                    const next = new Set(prev[day] ?? []);
                    next.add(index);
                    return { ...prev, [day]: next };
                });
            }
        } catch {
            // Network failure — no error state per the AC, the choice just stays pickable again.
        } finally {
            setAnswerState('idle');
        }
    };

    const handleShare = (day: number) => {
        if (!email) return;

        // Fire the bonus-ticket call independently (not awaited) — on a slow connection,
        // awaiting it first before opening the share sheet/window.open below can exhaust the
        // click event's transient user-activation window, causing the browser to silently
        // refuse both. A failed POST here shouldn't block sharing either way.
        void fetch(`${API_URL}/api/v1/advent/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day, email }),
        }).catch(() => { /* best-effort */ });

        const shareUrl = `${window.location.origin}/jolaleikur/2026`;
        const shareText = t('advent.shareText');
        if (typeof navigator.share !== 'undefined') {
            navigator.share({ title: t('advent.pageTitle'), text: shareText, url: shareUrl })
                .catch(() => { /* User cancelled — ignore, mirrors ShareButtons.tsx's handleNativeShare. */ });
        } else {
            window.open(
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
                '_blank',
                'noopener,noreferrer',
            );
        }
    };

    const prizes = t('advent.rules.prizes', { returnObjects: true }) as string[];

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('advent.pageTitle') }]}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <Tabs
                    value={tab}
                    onChange={(_, value: 'calendar' | 'rules') => setTab(value)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{ flexGrow: 1 }}
                >
                    <Tab value="calendar" label={t('advent.tabCalendar')} />
                    <Tab value="rules" label={t('advent.tabRules')} />
                </Tabs>
            </Box>

            {tab === 'calendar' && (
                <>
                    {email && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('advent.usingEmail', { email })}{' '}
                            <MuiLink component="button" type="button" onClick={clearEmail} underline="hover">
                                {t('advent.notYou')}
                            </MuiLink>
                        </Typography>
                    )}

                    <Grid container spacing={1.5}>
                        {Array.from({ length: DOOR_COUNT }, (_, i) => i + 1).map(day => {
                            const unlocked = isDoorUnlocked(day);
                            const won = hasWon(day);
                            return (
                                <Grid item xs={3} sm={2} md={2} key={day}>
                                    <Button
                                        aria-label={
                                            won
                                                ? t('advent.doorAriaWon', { day })
                                                : unlocked
                                                    ? t('advent.doorAriaOpen', { day })
                                                    : t('advent.doorAriaLocked', { day })
                                        }
                                        onClick={() => handleDoorClick(day)}
                                        disabled={!unlocked}
                                        fullWidth
                                        variant={won ? 'contained' : 'outlined'}
                                        color={won ? 'success' : 'primary'}
                                        sx={{
                                            minHeight: 48,
                                            minWidth: 44,
                                            aspectRatio: '1 / 1',
                                            fontSize: '1.1rem',
                                            fontWeight: 'bold',
                                            borderRadius: 2,
                                        }}
                                    >
                                        {won ? <CheckIcon /> : unlocked ? day : <LockIcon fontSize="small" />}
                                    </Button>
                                </Grid>
                            );
                        })}
                    </Grid>
                </>
            )}

            {tab === 'rules' && (
                <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <CardGiftcardIcon color="primary" />
                        <Typography variant="h6" fontWeight="bold">{t('advent.rules.title')}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                        {t('advent.rules.intro')}
                    </Typography>

                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                        {t('advent.rules.prizesTitle')}
                    </Typography>
                    <List dense sx={{ mb: 2 }}>
                        {prizes.map((prize, idx) => (
                            <ListItem key={idx} disableGutters>
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    <CardGiftcardIcon fontSize="small" color="secondary" />
                                </ListItemIcon>
                                <ListItemText primary={prize} />
                            </ListItem>
                        ))}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
                        {t('advent.rules.mechanic')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
                        {t('advent.rules.shareBonus')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
                        {t('advent.rules.signup')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
                        {t('advent.rules.draw')}
                    </Typography>

                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2 }}>
                        {t('advent.rules.privacyPrefix')}{' '}
                        <MuiLink component={RouterLink} to="/privacy">
                            {t('advent.rules.privacyLink')}
                        </MuiLink>
                    </Typography>
                </Paper>
            )}

            <Dialog open={selectedDay !== null} onClose={handleCloseDialog} fullWidth maxWidth="xs">
                {selectedDay !== null && (() => {
                    const day = selectedDay;
                    const dto = questions[day];
                    const won = hasWon(day);
                    const isLoading = loadingDay === day;

                    return (
                        <>
                            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                {t('advent.doorTitle', { day })}
                                <IconButton onClick={handleCloseDialog} size="small" aria-label={t('advent.close')}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </DialogTitle>
                            <DialogContent>
                                {isLoading && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                        <CircularProgress size={28} />
                                    </Box>
                                )}

                                {!isLoading && dto === null && (
                                    <Stack spacing={1.5} alignItems="center" sx={{ py: 1 }}>
                                        <Typography color="error">{t('advent.loadError')}</Typography>
                                        <Button
                                            onClick={() => void fetchQuestion(day)}
                                            variant="outlined"
                                            sx={{ textTransform: 'none' }}
                                        >
                                            {t('advent.retry')}
                                        </Button>
                                    </Stack>
                                )}

                                {!isLoading && dto && won && (
                                    <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
                                        <Typography variant="h6" color="success.main" fontWeight="bold">
                                            {t('advent.correctTitle')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" textAlign="center">
                                            {t('advent.correctBody')}
                                        </Typography>
                                        <Button
                                            component="a"
                                            href={dto.linkUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="outlined"
                                            endIcon={<OpenInNewIcon />}
                                            fullWidth
                                            sx={{ minHeight: 44, textTransform: 'none' }}
                                        >
                                            {isIcelandic ? dto.linkLabelIs : dto.linkLabelEn}
                                        </Button>
                                        <Button
                                            onClick={() => handleShare(day)}
                                            variant="contained"
                                            color="secondary"
                                            startIcon={<ShareIcon />}
                                            fullWidth
                                            sx={{ minHeight: 44, textTransform: 'none' }}
                                        >
                                            {t('advent.shareButton')}
                                        </Button>
                                    </Stack>
                                )}

                                {!isLoading && dto && !won && (
                                    <Stack spacing={2}>
                                        <Typography variant="body1">
                                            {isIcelandic ? dto.textIs : dto.textEn}
                                        </Typography>

                                        {!email && (
                                            <TextField
                                                type="email"
                                                label={t('advent.emailLabel')}
                                                helperText={emailError ? t('advent.emailInvalid') : t('advent.emailHelper')}
                                                error={emailError}
                                                value={emailDraft}
                                                onChange={e => { setEmailDraft(e.target.value); setEmailError(false); }}
                                                fullWidth
                                                inputProps={{ maxLength: 320 }}
                                            />
                                        )}

                                        <Stack spacing={1}>
                                            {(isIcelandic ? dto.choicesIs : dto.choicesEn).map((choice, index) => {
                                                const isWrong = wrongChoices[day]?.has(index) ?? false;
                                                return (
                                                    <Button
                                                        key={index}
                                                        variant="outlined"
                                                        color={isWrong ? 'error' : 'primary'}
                                                        fullWidth
                                                        disabled={isWrong || answerState === 'submitting'}
                                                        onClick={() => void handleChoice(day, index)}
                                                        sx={{
                                                            borderRadius: 2,
                                                            py: 1.2,
                                                            textTransform: 'none',
                                                            fontSize: '1rem',
                                                            opacity: isWrong ? 0.4 : 1,
                                                            textDecoration: isWrong ? 'line-through' : 'none',
                                                            transition: 'opacity 0.3s',
                                                        }}
                                                    >
                                                        {choice}
                                                    </Button>
                                                );
                                            })}
                                        </Stack>
                                    </Stack>
                                )}
                            </DialogContent>
                        </>
                    );
                })()}
            </Dialog>
        </Layout>
    );
}

import { useState } from 'react';
import { Container, Typography, Paper, TextField, Button, CircularProgress, Box } from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import type { PaletteMode } from '@mui/material';
import { usePageTitle } from '../hooks/usePageTitle';
import { API_URL } from '../hooks/useTrails';

interface NewsletterPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

// Matches the repo's existing client-side email check (SendTipButton/feedback forms use a plain
// type="email" field with no extra validation) closely enough for a quick reject before any
// network call, while still letting the backend's System.Net.Mail.MailAddress check be the
// authority on what actually counts as valid.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'sending' | 'subscribed' | 'error';

export default function NewsletterPage({ mode, onToggleMode }: NewsletterPageProps) {
    const { t } = useTranslation();
    usePageTitle(t('nav.newsletter'));
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [fieldError, setFieldError] = useState(false);

    async function handleSubmit() {
        const trimmed = email.trim();
        if (!EMAIL_PATTERN.test(trimmed)) {
            setFieldError(true);
            return;
        }
        setFieldError(false);
        setStatus('sending');

        try {
            const res = await fetch(`${API_URL}/api/v1/newsletter/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed }),
            });
            if (!res.ok) throw new Error();
            setStatus('subscribed');
        } catch {
            setStatus('error');
        }
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.newsletter') }]}>
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                    {status === 'subscribed' ? (
                        <>
                            <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                            <Typography color="text.secondary">
                                {t('newsletter.success')}
                            </Typography>
                        </>
                    ) : (
                        <>
                            <EmailOutlinedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                            <Typography variant="h5" fontWeight={700} gutterBottom>
                                {t('newsletter.title')}
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 3 }}>
                                {t('newsletter.description')}
                            </Typography>
                            <Box
                                component="form"
                                onSubmit={e => { e.preventDefault(); void handleSubmit(); }}
                                sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch' }}
                            >
                                <TextField
                                    type="email"
                                    label={t('newsletter.emailLabel')}
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setFieldError(false); setStatus('idle'); }}
                                    error={fieldError}
                                    helperText={fieldError ? t('newsletter.emailInvalid') : ' '}
                                    disabled={status === 'sending'}
                                    fullWidth
                                    inputProps={{ maxLength: 320 }}
                                />
                                {status === 'error' && (
                                    <Typography variant="body2" color="error">
                                        {t('newsletter.error')}
                                    </Typography>
                                )}
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={status === 'sending'}
                                    startIcon={status === 'sending' ? <CircularProgress size={16} color="inherit" /> : undefined}
                                    sx={{ minHeight: 44 }}
                                >
                                    {t('newsletter.subscribe')}
                                </Button>
                            </Box>
                        </>
                    )}
                </Paper>
            </Container>
        </Layout>
    );
}

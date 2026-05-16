import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import GoogleIcon from '@mui/icons-material/Google';
import { supabase } from '../hooks/supabase';
import { AUTH_PENDING_KEY } from '../hooks/authConstants';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { t } = useTranslation();
  const authRedirectTo = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() || window.location.origin;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoadingGoogle(true);
      setError(null);
      window.sessionStorage.setItem(AUTH_PENDING_KEY, '1');
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authRedirectTo,
        },
      });
      if (err) {
        window.sessionStorage.removeItem(AUTH_PENDING_KEY);
        setError(err.message || 'Failed to sign in with Google');
      }
    } catch (err) {
      window.sessionStorage.removeItem(AUTH_PENDING_KEY);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError(t('auth.emailPlaceholder'));
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirectTo,
        },
      });
      if (err) {
        setError(err.message || 'Failed to send magic link');
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !loadingGoogle) {
      setEmail('');
      setError(null);
      setMagicLinkSent(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('auth.signIn')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {magicLinkSent && (
            <Alert severity="success">{t('auth.magicLinkSent')}</Alert>
          )}

          {!magicLinkSent && (
            <>
              <Button
                fullWidth
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleSignIn}
                disabled={loading || loadingGoogle}
                sx={{ py: 1 }}
              >
                {loadingGoogle ? <CircularProgress size={20} /> : t('auth.continueWithGoogle')}
              </Button>

              <Divider>{t('auth.orEmail')}</Divider>

              <TextField
                fullWidth
                label={t('auth.emailPlaceholder')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                size="small"
              />
            </>
          )}

          {magicLinkSent && (
            <Typography variant="body2" color="text.secondary" align="center">
              {t('auth.magicLinkSent')}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || loadingGoogle}>
          {magicLinkSent ? t('auth.close') : t('common.cancel')}
        </Button>
        {!magicLinkSent && (
          <Button
            onClick={handleMagicLink}
            variant="contained"
            disabled={loading || loadingGoogle || !email.trim()}
          >
            {loading ? <CircularProgress size={20} /> : t('auth.sendMagicLink')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

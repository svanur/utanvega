import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Divider, CircularProgress, Alert,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useTranslation } from 'react-i18next';
import { supabase } from '../hooks/supabase';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setLoadingGoogle(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setLoadingEmail(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoadingEmail(false);
    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
  };

  const handleClose = () => {
    setEmail('');
    setMagicSent(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>{t('auth.signIn')}</DialogTitle>
      <DialogContent>
        {magicSent ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            {t('auth.magicLinkSent')}
          </Alert>
        ) : (
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}

            <Button
              variant="outlined"
              fullWidth
              startIcon={loadingGoogle ? <CircularProgress size={18} /> : <GoogleIcon />}
              onClick={handleGoogle}
              disabled={loadingGoogle}
              sx={{ textTransform: 'none', py: 1.2 }}
            >
              {t('auth.continueWithGoogle')}
            </Button>

            <Divider>
              <Typography variant="caption" color="text.secondary">
                {t('auth.orEmail')}
              </Typography>
            </Divider>

            <TextField
              label={t('auth.emailPlaceholder')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
              size="small"
              fullWidth
              autoComplete="email"
            />
            <Button
              variant="contained"
              fullWidth
              onClick={handleMagicLink}
              disabled={loadingEmail || !email.trim()}
              startIcon={loadingEmail ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ textTransform: 'none' }}
            >
              {t('auth.sendMagicLink')}
            </Button>
          </Box>
        )}
      </DialogContent>
      {magicSent && (
        <DialogActions>
          <Button onClick={handleClose}>{t('auth.close')}</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

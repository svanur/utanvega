import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Paper, Stack, Divider, Avatar,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { PaletteMode } from '@mui/material';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTickedTrails } from '../hooks/useTickedTrails';
import { useTrails } from '../hooks/useTrails';
import { TrailCard } from '../components/TrailCard';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function ProfilePage({ mode, onToggleMode }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const { tickedSlugs, loading: tickLoading } = useTickedTrails();
  const { trails } = useTrails();

  if (authLoading) {
    return (
      <Layout mode={mode} onToggleMode={onToggleMode}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!user) {
    navigate('/');
    return null;
  }

  const displayName = user.user_metadata?.full_name || user.email || '';
  const initials = displayName.split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2);
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  const tickedTrails = trails.filter(t => tickedSlugs.has(t.slug));

  return (
    <Layout mode={mode} onToggleMode={onToggleMode}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        {t('trail.backToTrails')}
      </Button>

      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={avatarUrl} sx={{ width: 56, height: 56, fontSize: '1.2rem', bgcolor: 'primary.main' }}>
            {!avatarUrl && initials}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" fontWeight="bold">{displayName}</Typography>
            <Typography variant="body2" color="text.secondary">{t('profile.signedInAs', { email: user.email })}</Typography>
          </Box>
          <Button variant="outlined" size="small" onClick={signOut}>
            {t('auth.signOut')}
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <CheckCircleIcon color="success" />
          <Typography variant="h6" fontWeight="bold">
            {t('profile.tickedTrails')}
            {!tickLoading && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({tickedTrails.length})
              </Typography>
            )}
          </Typography>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {tickLoading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={28} />
          </Box>
        ) : tickedTrails.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={3}>
            {t('profile.noTicks')}
          </Typography>
        ) : (
          tickedTrails.map(trail => (
            <TrailCard key={trail.slug} trail={trail} disableGestures />
          ))
        )}
      </Paper>
    </Layout>
  );
}

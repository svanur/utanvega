import React from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
  PaletteMode,
  Divider,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageIcon from '@mui/icons-material/ManageAccounts';
import SettingsIcon from '@mui/icons-material/Settings';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuthContext';
import { useTickedTrails } from '../hooks/useTickedTrails';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { getCompletedTrailCount } from '../utils/trailActivityAggregator';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function MyProfilePage({ mode, onToggleMode }: Props) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { tickedSlugs, loading: tickedLoading } = useTickedTrails();
  const { activities } = useTrailActivities();
  const [signingOut, setSigningOut] = React.useState(false);
  const completedTrailCount = React.useMemo(
    () => getCompletedTrailCount(tickedSlugs, activities),
    [activities, tickedSlugs]
  );

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('profile.title') }]}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {t('profile.title')}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                {t('profile.signedInAs', { email: user.email })}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {t('auth.signOut')}
            </Button>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                {t('profile.publicProfileSettings')}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                {t('profile.publicProfileSettingsDescription')}
              </Typography>
              <Button
                variant="contained"
                component={RouterLink}
                to="/my/profile/settings"
                startIcon={<SettingsIcon />}
              >
                {t('profile.openPublicProfileSettings')}
              </Button>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                {t('profile.tickedTrails')}
              </Typography>
              {tickedLoading ? (
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <CircularProgress size={18} />
                  <Typography color="text.secondary">
                    {t('profile.loadingTicks')}
                  </Typography>
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {completedTrailCount > 0
                    ? `${completedTrailCount} ${t('profile.tickedTrails').toLowerCase()}`
                    : t('profile.noTicks')}
                </Typography>
              )}
              {completedTrailCount > 0 && (
                <Button
                  variant="contained"
                  startIcon={<ManageIcon />}
                  href="/my/trails"
                >
                  {t('profile.manageTrails')}
                </Button>
              )}
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Layout>
  );
}

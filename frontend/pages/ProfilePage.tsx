import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, Container, Paper, Stack, Typography, PaletteMode, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTickedTrails } from '../hooks/useTickedTrails';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { formatSeconds } from '../utils/timeFormat';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function ProfilePage({ mode, onToggleMode }: Props) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { tickedSlugs } = useTickedTrails();
  const { activities } = useTrailActivities();
  const [signingOut, setSigningOut] = useState(false);
  const completedTrailCount = useMemo(
    () => new Set([...tickedSlugs, ...activities.map(a => a.trailSlug)]).size,
    [activities, tickedSlugs]
  );

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const recentActivities = activities.slice(0, 5);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Layout mode={mode} onToggleMode={onToggleMode}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => window.history.back()} sx={{ mb: 2 }}>
          {t('trail.backToTrails')}
        </Button>

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

          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            {t('profile.tickedTrails')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {completedTrailCount > 0 ? `${completedTrailCount} ${t('profile.tickedTrails').toLowerCase()}` : t('profile.noTicks')}
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              {t('profile.recentActivities')}
            </Typography>
            {activities.length > 5 && (
              <Button variant="text" size="small" href="/activities">
                {t('profile.viewAll')}
              </Button>
            )}
          </Stack>

          {recentActivities.length === 0 ? (
            <Typography color="text.secondary">{t('activities.noActivities')}</Typography>
          ) : (
            <Stack spacing={2}>
              {recentActivities.map(activity => (
                <Box
                  key={activity.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="start">
                    <Box flex={1}>
                      <Typography variant="body2" fontWeight="bold">
                        {activity.trailSlug}
                      </Typography>
                      {activity.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {activity.notes}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', ml: 2 }}>
                      {formatSeconds(activity.timeInSeconds)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Container>
    </Layout>
  );
}

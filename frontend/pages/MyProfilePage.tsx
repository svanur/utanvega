import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
  PaletteMode,
  Divider,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageIcon from '@mui/icons-material/ManageAccounts';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useTickedTrails } from '../hooks/useTickedTrails';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { getCompletedTrailCount } from '../utils/trailActivityAggregator';
import {
  AVATAR_PRESETS,
  getAvatarFallbackText,
  getAvatarImageSrc,
  getAvatarPreset,
  toAvatarPresetValue,
} from '../utils/avatarPresets';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function MyProfilePage({ mode, onToggleMode }: Props) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, error: profileError, updateProfile } = useProfile();
  const { tickedSlugs, loading: tickedLoading } = useTickedTrails();
  const { activities } = useTrailActivities();
  const [signingOut, setSigningOut] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [displayNameError, setDisplayNameError] = React.useState<string | null>(null);
  const [displayNameSaved, setDisplayNameSaved] = React.useState(false);
  const [savingDisplayName, setSavingDisplayName] = React.useState(false);
  const completedTrailCount = React.useMemo(
    () => getCompletedTrailCount(tickedSlugs, activities),
    [activities, tickedSlugs]
  );
  const selectedPreset = React.useMemo(() => getAvatarPreset(avatarUrl), [avatarUrl]);

  React.useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
    setAvatarUrl(profile?.avatarUrl ?? '');
  }, [profile?.avatarUrl, profile?.displayName]);

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

  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    const trimmedAvatarUrl = avatarUrl.trim();
    const currentDisplayName = profile?.displayName ?? '';
    const currentAvatarUrl = (profile?.avatarUrl ?? '').trim();
    setDisplayNameSaved(false);

    if (!trimmed) {
      setDisplayNameError(t('profile.displayNameRequired'));
      return;
    }

    if (trimmed === currentDisplayName && trimmedAvatarUrl === currentAvatarUrl) {
      setDisplayNameError(null);
      return;
    }

    setDisplayNameError(null);
    setSavingDisplayName(true);
    try {
      await updateProfile({
        displayName: trimmed,
        avatarUrl: trimmedAvatarUrl ? trimmedAvatarUrl : null,
      });
      setDisplayNameSaved(true);
    } catch {
      setDisplayNameError(t('profile.displayNameUpdateFailed'));
    } finally {
      setSavingDisplayName(false);
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

          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                {t('profile.displayNameTitle')}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                {t('profile.displayNameDescription')}
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <Avatar src={getAvatarImageSrc(avatarUrl)} alt={displayName || user.email || 'User'} sx={{ width: 40, height: 40 }}>
                  {getAvatarFallbackText(avatarUrl, (displayName || user.email || 'U').charAt(0).toUpperCase())}
                </Avatar>
                <Typography color="text.secondary" variant="body2">
                  {t('profile.avatarPreview')}
                </Typography>
              </Stack>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                {t('profile.avatarPresetsTitle')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                {AVATAR_PRESETS.map((preset) => (
                  <Chip
                    key={preset.id}
                    label={`${preset.emoji} ${t(preset.labelKey)}`}
                    variant={selectedPreset?.id === preset.id ? 'filled' : 'outlined'}
                    color={selectedPreset?.id === preset.id ? 'primary' : 'default'}
                    onClick={() => {
                      setAvatarUrl(toAvatarPresetValue(preset.id));
                      setDisplayNameSaved(false);
                    }}
                    sx={{ height: 32 }}
                  />
                ))}
              </Stack>
              <Stack spacing={1.5} sx={{ mb: 1 }}>
                <TextField
                  label={t('profile.displayNameLabel')}
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setDisplayNameError(null);
                    setDisplayNameSaved(false);
                  }}
                  fullWidth
                  size="small"
                  disabled={profileLoading || savingDisplayName}
                  error={Boolean(displayNameError)}
                  helperText={displayNameError ?? t('profile.displayNameHelper')}
                />
                <TextField
                  label={t('profile.avatarUrlLabel')}
                  value={avatarUrl}
                  onChange={(event) => {
                    setAvatarUrl(event.target.value);
                    setDisplayNameSaved(false);
                  }}
                  fullWidth
                  size="small"
                  placeholder="https://..."
                  disabled={profileLoading || savingDisplayName}
                  helperText={t('profile.avatarUrlHelper')}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleSaveDisplayName}
                  disabled={profileLoading || savingDisplayName || !profile}
                >
                  {savingDisplayName ? t('profile.savingDisplayName') : t('profile.saveDisplayName')}
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    setAvatarUrl('');
                    setDisplayNameSaved(false);
                  }}
                  disabled={profileLoading || savingDisplayName}
                >
                  {t('profile.clearAvatar')}
                </Button>
              </Stack>
              {profileError && (
                <Typography color="error" variant="body2" sx={{ mb: 1 }}>
                  {profileError}
                </Typography>
              )}
              {displayNameSaved && (
                <Typography color="success.main" variant="body2" sx={{ mb: 1 }}>
                  {t('profile.displayNameSaved')}
                </Typography>
              )}
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

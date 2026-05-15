import React from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  PaletteMode,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  AVATAR_PRESETS,
  getAvatarFallbackText,
  getAvatarImageSrc,
  getAvatarPreset,
  toAvatarPresetValue,
} from '../utils/avatarPresets';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function MyProfileSettingsPage({ mode, onToggleMode }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError, updateProfile } = useProfile();
  const [displayName, setDisplayName] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [displayNameError, setDisplayNameError] = React.useState<string | null>(null);
  const [displayNameSaved, setDisplayNameSaved] = React.useState(false);
  const [savingDisplayName, setSavingDisplayName] = React.useState(false);
  const selectedPreset = React.useMemo(() => getAvatarPreset(avatarUrl), [avatarUrl]);

  React.useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
    setAvatarUrl(profile?.avatarUrl ?? '');
  }, [profile?.avatarUrl, profile?.displayName]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

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
        <Button component={RouterLink} to="/my/profile" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          {t('trail.backToProfile')}
        </Button>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
            {t('profile.publicProfileSettings')}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
            {t('profile.displayNameDescription')}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box>
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
        </Paper>
      </Container>
    </Layout>
  );
}

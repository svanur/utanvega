import { useState } from 'react';
import { Avatar, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../hooks/useAuthContext';
import LoginModal from './LoginModal';

export default function UserAvatar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, signOut, loading } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    navigate('/my/profile');
    handleCloseMenu();
  };

  const handleSignOut = async () => {
    await signOut();
    handleCloseMenu();
  };

  // Not logged in - show login button
  if (!user) {
    return (
      <>
        <IconButton
          size="small"
          onClick={() => setLoginModalOpen(true)}
          disabled={loading}
          color="inherit"
          title={t('auth.signIn')}
          aria-label={t('auth.signIn')}
          aria-busy={loading}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
        </IconButton>
        <LoginModal
          open={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
        />
      </>
    );
  }

  // Logged in - show avatar with menu
  const initials = user.email
    ?.split('@')[0]
    .split('.')
    .map(p => p[0].toUpperCase())
    .join('')
    .substring(0, 2) || 'U';

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpenMenu}
        sx={{ p: 0 }}
        aria-label={t('profile.title')}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'primary.main',
            fontSize: '0.875rem',
            fontWeight: 'bold',
          }}
        >
          {initials}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>
          <ListItemText>{user.email}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleProfile}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('profile.title')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('auth.signOut')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

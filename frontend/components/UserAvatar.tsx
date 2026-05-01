import { useState } from 'react';
import { Avatar, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';

export default function UserAvatar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (!user) {
    return (
      <>
        <Tooltip title={t('auth.signIn')}>
          <IconButton color="inherit" size="small" onClick={() => setLoginOpen(true)} aria-label="sign in">
            <PersonIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email || '';
  const initials = displayName
    .split(' ')
    .map((s: string) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <>
      <Tooltip title={displayName}>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.25 }}>
          <Avatar
            src={avatarUrl}
            sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'primary.main' }}
          >
            {!avatarUrl && initials}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { navigate('/profile'); setAnchorEl(null); }}>
          <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('profile.title')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { signOut(); setAnchorEl(null); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('auth.signOut')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

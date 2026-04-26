import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Button, TextField, Switch, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Tooltip, InputAdornment,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

interface FeatureFlagsPageProps {
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

export default function FeatureFlagsPage({ onNotify }: FeatureFlagsPageProps) {
  const { flags, loading, toggleFlag, createFlag, deleteFlag, updateDescription } = useFeatureFlags();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editDescId, setEditDescId] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [showDisabledOnly, setShowDisabledOnly] = useState(false);

  const filteredFlags = flags.filter(f => {
    if (showDisabledOnly && f.enabled) return false;
    if (!searchQuery.trim()) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const disabledCount = flags.filter(f => !f.enabled).length;

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleFlag(id, !current);
      onNotify(`Feature ${!current ? 'enabled' : 'disabled'}`);
    } catch {
      onNotify('Failed to toggle feature', 'error');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createFlag(newName.trim(), newDescription.trim() || undefined);
      onNotify(`Feature "${newName}" created`);
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create feature', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete feature flag "${name}"?`)) return;
    try {
      await deleteFlag(id);
      onNotify(`Feature "${name}" deleted`);
    } catch {
      onNotify('Failed to delete feature', 'error');
    }
  };

  const handleSaveDescription = async (id: string) => {
    try {
      await updateDescription(id, editDescValue);
      setEditDescId(null);
      onNotify('Description updated');
    } catch {
      onNotify('Failed to update description', 'error');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5">Feature Flags</Typography>
          <Chip label={(searchQuery.trim() || showDisabledOnly) ? `${filteredFlags.length} / ${flags.length}` : flags.length} size="small" color="primary" />
          {disabledCount > 0 && (
            <Chip
              label={`${disabledCount} disabled`}
              size="small"
              onClick={() => setShowDisabledOnly(v => !v)}
              sx={{
                cursor: 'pointer',
                bgcolor: showDisabledOnly ? 'error.main' : 'error.light',
                color: 'error.contrastText',
                '&:hover': { bgcolor: 'error.main' },
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search flags…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={{ width: 200 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearchQuery('')}><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreate(true)}>
            New Flag
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Toggle</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFlags.map(flag => (
              <TableRow key={flag.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                    {flag.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  {editDescId === flag.id ? (
                    <TextField
                      size="small"
                      value={editDescValue}
                      onChange={e => setEditDescValue(e.target.value)}
                      onBlur={() => handleSaveDescription(flag.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveDescription(flag.id);
                        if (e.key === 'Escape') setEditDescId(null);
                      }}
                      autoFocus
                      fullWidth
                      variant="standard"
                    />
                  ) : (
                    <Tooltip title="Click to edit">
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' }, minHeight: 20 }}
                        onClick={() => { setEditDescId(flag.id); setEditDescValue(flag.description ?? ''); }}
                      >
                        {flag.description || '—'}
                      </Typography>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={flag.enabled ? 'ON' : 'OFF'}
                    color={flag.enabled ? 'success' : 'default'}
                    size="small"
                    variant={flag.enabled ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={flag.enabled}
                    onChange={() => handleToggle(flag.id, flag.enabled)}
                    color="success"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(flag.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' '}
                    {new Date(flag.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDelete(flag.id, flag.name)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filteredFlags.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    {searchQuery.trim() ? `No flags match "${searchQuery}"` : 'No feature flags yet. Click "New Flag" to create one.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Feature Flag</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="e.g. smart_presets"
            helperText="Use snake_case for feature flag names"
            autoFocus
          />
          <TextField
            label="Description"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="What does this feature do?"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || saving}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

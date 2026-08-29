import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Button, TextField, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress, InputAdornment,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useTags, TagDto } from '../hooks/useTags';
import { apiFetch } from '../hooks/api';
import BilingualTextField from '../components/BilingualTextField';
import { useTranslate } from '../hooks/useTranslate';
import TranslateIcon from '@mui/icons-material/Translate';
import { trimToUndefined } from '../utils/strings';

const PRESET_COLORS = [
  '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0',
  '#00bcd4', '#ff5722', '#607d8b', '#795548', '#e91e63',
];

interface TagManagementProps {
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

export default function TagManagement({ onNotify }: TagManagementProps) {
  const { tags, loading, refresh } = useTags();
  const [editTag, setEditTag] = useState<{ id?: string; name: string; nameEn?: string; color: string | null; slug?: string } | null>(null);
  const [slugUnlocked, setSlugUnlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  const handleSave = async () => {
    if (!editTag || !editTag.name.trim()) return;
    setSaving(true);
    try {
      if (editTag.id) {
        await apiFetch(`/api/v1/admin/tags/${editTag.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: editTag.name,
            nameEn: editTag.nameEn || undefined,
            color: editTag.color,
            slug: slugUnlocked ? trimToUndefined(editTag.slug ?? '') : undefined,
          }),
        });
        onNotify(`Tag "${editTag.name}" updated`, 'success');
      } else {
        await apiFetch('/api/v1/admin/tags', {
          method: 'POST',
          body: JSON.stringify({ name: editTag.name, nameEn: editTag.nameEn || undefined, color: editTag.color }),
        });
        onNotify(`Tag "${editTag.name}" created`, 'success');
      }
      setEditTag(null);
      refresh();
    } catch {
      onNotify('Failed to save tag', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagDto) => {
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from ${tag.trailCount} trail(s).`)) return;
    try {
      await apiFetch(`/api/v1/admin/tags/${tag.id}`, { method: 'DELETE' });
      onNotify(`Tag "${tag.name}" deleted`, 'success');
      refresh();
    } catch {
      onNotify('Failed to delete tag', 'error');
    }
  };

  if (loading) {
    return <Box sx={{ p: 3 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" fontWeight="bold">Tags</Typography>
          <Chip label={searchQuery.trim() ? `${filteredTags.length} / ${tags.length}` : tags.length} size="small" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search tags…"
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditTag({ name: '', color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] });
              setSlugUnlocked(false);
            }}
          >
            New Tag
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tag</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell align="center">Trails</TableCell>
              <TableCell align="right" width={100}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTags.map(tag => (
              <TableRow key={tag.id}>
                <TableCell>
                  <Chip
                    label={tag.name}
                    sx={{ backgroundColor: tag.color || undefined, color: tag.color ? '#fff' : undefined }}
                    variant={tag.color ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>{tag.slug}</TableCell>
                <TableCell align="center">{tag.trailCount}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => {
                    setEditTag({ id: tag.id, name: tag.name, nameEn: tag.nameEn ?? undefined, color: tag.color, slug: tag.slug });
                    setSlugUnlocked(false);
                  }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(tag)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filteredTags.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {searchQuery.trim() ? `No tags match "${searchQuery}"` : 'No tags yet. Create your first tag!'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={!!editTag} onClose={() => setEditTag(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{editTag?.id ? 'Edit Tag' : 'New Tag'}</DialogTitle>
        <DialogContent>
          <BilingualTextField
            label="Tag Name"
            fullWidth
            valueIs={editTag?.name || ''}
            valueEn={editTag?.nameEn || ''}
            onChangeIs={v => setEditTag(prev => prev ? { ...prev, name: v } : null)}
            onChangeEn={v => setEditTag(prev => prev ? { ...prev, nameEn: v } : null)}
            sx={{ mt: 1, mb: 2 }}
            autoFocus
          />
          {editTag?.id && (
            <TextField
              label="Slug"
              value={editTag.slug ?? ''}
              onChange={e => setEditTag(prev => prev ? { ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') } : null)}
              fullWidth
              disabled={!slugUnlocked}
              helperText={slugUnlocked ? 'Changing the slug breaks existing bookmarks and shared links.' : 'Lowercase letters, numbers and hyphens only'}
              inputProps={{ style: { fontFamily: 'monospace' } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={slugUnlocked ? 'Lock slug' : 'Changing the slug will break existing bookmarks or shared links. Click to unlock.'}>
                      <IconButton size="small" onClick={() => setSlugUnlocked(v => !v)} color={slugUnlocked ? 'warning' : 'default'}>
                        {slugUnlocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
          )}
          <Typography variant="subtitle2" gutterBottom>Color</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <Box
                key={c}
                onClick={() => setEditTag(prev => prev ? { ...prev, color: c } : null)}
                sx={{
                  width: 32, height: 32, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                  border: editTag?.color === c ? '3px solid #000' : '2px solid transparent',
                  '&:hover': { opacity: 0.8 },
                }}
              />
            ))}
            <Box
              onClick={() => setEditTag(prev => prev ? { ...prev, color: null } : null)}
              sx={{
                width: 32, height: 32, borderRadius: '50%', backgroundColor: '#eee', cursor: 'pointer',
                border: !editTag?.color ? '3px solid #000' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              }}
            >
              ∅
            </Box>
          </Box>
          {editTag?.name && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">Preview:</Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={editTag.name}
                  sx={{ backgroundColor: editTag.color || undefined, color: editTag.color ? '#fff' : undefined }}
                  variant={editTag.color ? 'filled' : 'outlined'}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
          <Button
            startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
            disabled={translating || !editTag?.name.trim()}
            onClick={async () => {
              if (!editTag) return;
              const [nameEn] = await translate([editTag.name]);
              setEditTag(prev => prev ? { ...prev, nameEn } : null);
            }}
          >
            Translate to EN
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setEditTag(null)}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" disabled={saving || !editTag?.name.trim()}>
              {saving ? 'Saving...' : editTag?.id ? 'Update' : 'Create'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

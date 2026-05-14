import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Checkbox, FormControlLabel, Alert, CircularProgress,
  Autocomplete,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTrails } from '../hooks/useTrails';
import { parseTimeString, formatSeconds } from '../utils/timeFormat';

interface ActivityFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { trailSlug: string; time: number; notes: string; isPublic: boolean }) => Promise<void>;
  initialTrailSlug?: string;
  initialTime?: number;
  initialNotes?: string;
  initialIsPublic?: boolean;
  isLoading?: boolean;
  error?: string;
}

export default function ActivityForm({
  open,
  onClose,
  onSubmit,
  initialTrailSlug,
  initialTime,
  initialNotes,
  initialIsPublic,
  isLoading,
  error,
}: ActivityFormProps) {
  const { t } = useTranslation();
  const { trails } = useTrails(true); // No geolocation needed

  const [trailSlug, setTrailSlug] = useState<string | null>(initialTrailSlug ?? null);
  const [timeStr, setTimeStr] = useState(initialTime ? formatSeconds(initialTime) : '00:00:00');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [isPublic, setIsPublic] = useState(initialIsPublic ?? false);

  useEffect(() => {
    if (open && initialTrailSlug) {
      setTrailSlug(initialTrailSlug);
    }
  }, [open, initialTrailSlug]);

  const handleSubmit = async () => {
    if (!trailSlug || !timeStr.trim()) return;
    const time = parseTimeString(timeStr);
    if (time === 0) {
      alert(t('activity.invalidTime') || 'Invalid time format');
      return;
    }
    try {
      await onSubmit({ trailSlug, time, notes, isPublic });
      handleClose();
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleClose = () => {
    setTrailSlug(initialTrailSlug ?? null);
    setTimeStr(initialTime ? formatSeconds(initialTime) : '00:00:00');
    setNotes(initialNotes ?? '');
    setIsPublic(initialIsPublic ?? false);
    onClose();
  };

  const selectedTrail = trails.find(t => t.slug === trailSlug);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('activity.logActivity')}</DialogTitle>
      <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Autocomplete
          options={trails}
          getOptionLabel={(option) => option.name}
          value={selectedTrail ?? null}
          onChange={(_, value) => setTrailSlug(value?.slug ?? null)}
          renderInput={(params) => (
            <TextField {...params} label={t('activity.selectTrail')} required />
          )}
          disabled={!!initialTrailSlug}
        />

        <TextField
          label={t('activity.time')}
          value={timeStr}
          onChange={(e) => setTimeStr(e.target.value)}
          placeholder="HH:MM:SS"
          helperText="Format: HH:MM:SS or MM:SS"
        />

        <TextField
          label={t('activity.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          rows={3}
          placeholder={t('activity.notesPlaceholder')}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
          }
          label={t('activity.makePublic')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!trailSlug || !timeStr || isLoading}
          startIcon={isLoading ? <CircularProgress size={18} /> : undefined}
        >
          {t('activity.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

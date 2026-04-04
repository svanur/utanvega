import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TrailMap from './TrailMap';
import GpxBulkUpload from './GpxBulkUpload';

interface TrailMapDialogProps {
  trail: { id: string; name: string } | null;
  onClose: () => void;
}

export function TrailMapDialog({ trail, onClose }: TrailMapDialogProps) {
  return (
    <Dialog open={Boolean(trail)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {trail?.name} - Trail Map
        <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {trail && <TrailMap trailId={trail.id} trailName={trail.name} />}
      </DialogContent>
    </Dialog>
  );
}

interface DeleteTrailDialogProps {
  trail: { id: string; name: string } | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTrailDialog({ trail, deleting, onClose, onConfirm }: DeleteTrailDialogProps) {
  return (
    <Dialog open={Boolean(trail)} onClose={onClose}>
      <DialogTitle>Delete Trail?</DialogTitle>
      <DialogContent>
        Are you sure you want to delete <strong>{trail?.name}</strong>? This action cannot be undone.
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface BulkUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

export function BulkUploadDialog({ open, onClose, onUploadSuccess, onNotify }: BulkUploadDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Bulk Upload GPX Files
        <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select or drag multiple GPX files. Each file will create a new trail with the filename as the trail name.
        </Typography>
        <GpxBulkUpload
          onUploadSuccess={() => {
            onUploadSuccess();
            onClose();
          }}
          onNotify={onNotify}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

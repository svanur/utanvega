import { lazy, Suspense } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Typography, Box, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GpxBulkUpload from './GpxBulkUpload';
import type { Trail } from '../hooks/useTrails';

// Leaflet + react-leaflet are a heavy dependency (~150KB) that most trail-list visits never
// need — only load them once the map dialog is actually opened, not as part of the
// /trails list page's initial bundle.
const TrailMap = lazy(() => import('./TrailMap'));
const QUICK_VIEW_MAP_HEIGHT = 200;

interface TrailMapDialogProps {
  trail: Trail | null;
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
        {trail && (
          <Suspense fallback={
            <Box sx={{ height: QUICK_VIEW_MAP_HEIGHT, mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          }>
            <TrailMap trailId={trail.id} trailName={trail.name} height={QUICK_VIEW_MAP_HEIGHT} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeleteTrailDialogProps {
  trail: { id: string; name: string; slug?: string } | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTrailDialog({ trail, deleting, onClose, onConfirm }: DeleteTrailDialogProps) {
  return (
    <Dialog open={Boolean(trail)} onClose={onClose}>
      <DialogTitle>Delete Trail?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Delete <strong>{trail?.name}</strong>?
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <Box component="ul" sx={{ pl: 2.5, my: 0 }}>
            <li>
              The trail is <strong>archived, not erased</strong> — you'll still find it under{' '}
              <strong>Show Archived</strong>.
            </li>
            <li>
              Its web address changes from <code>/{trail?.slug}</code> to{' '}
              <code>/{trail?.slug}-deleted-1a2b3c4d</code>. The trail's name stays the same.
            </li>
            <li>
              That frees up <code>/{trail?.slug}</code> for another trail to use.
            </li>
            <li>
              Restoring brings the trail back on the new address. To put it back on{' '}
              <code>/{trail?.slug}</code>, edit the trail and set the address yourself — that works{' '}
              <strong>as long as no other trail has claimed it meanwhile</strong>.
            </li>
          </Box>
        </Typography>
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

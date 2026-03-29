import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Chip, Button, CircularProgress, Alert, Box, Dialog, DialogTitle, DialogContent, IconButton, DialogActions, FormControlLabel, Switch } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import { useState } from 'react';
import { useTrails } from '../hooks/useTrails';
import { apiFetch } from '../hooks/api';
import TrailMap from '../components/TrailMap';
import TrailEditDialog from '../components/TrailEditDialog';
import GpxBulkUpload from '../components/GpxBulkUpload';

export default function TrailList({ onNotify }: { onNotify: (message: string, severity?: 'success' | 'error') => void }) {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { trails, loading, error, refresh } = useTrails(includeDeleted);
  const [selectedTrailMap, setSelectedTrailMap] = useState<{ id: string, name: string } | null>(null);
  const [selectedTrailEdit, setSelectedTrailEdit] = useState<string | null>(null);
  const [trailToDelete, setTrailToDelete] = useState<{ id: string, name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const handleDelete = async () => {
    if (!trailToDelete) return;
    try {
        setDeleting(true);
        await apiFetch(`/api/v1/admin/trails/${trailToDelete.id}`, { method: 'DELETE' });
        setTrailToDelete(null);
        onNotify('Trail deleted successfully');
        refresh();
    } catch (err) {
        onNotify('Failed to delete trail', 'error');
    } finally {
        setDeleting(false);
    }
  };

  const handleRestore = async (trail: any) => {
    try {
        await apiFetch(`/api/v1/admin/trails/${trail.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...trail,
                status: 'Draft',
                updatedBy: 'admin'
            }),
        });
        onNotify('Trail restored to Draft');
        refresh();
    } catch (err) {
        onNotify('Failed to restore trail', 'error');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Trails</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            variant="contained" 
            startIcon={<CloudUploadIcon />} 
            onClick={() => setShowBulkUpload(true)}
          >
            Bulk Upload
          </Button>
          <FormControlLabel 
            control={<Switch checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />} 
            label="Show Deleted" 
          />
          <Button startIcon={<RefreshIcon />} onClick={refresh}>Refresh</Button>
        </Box>
      </Box>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Length (km)</TableCell>
              <TableCell align="right">Gain (m)</TableCell>
              <TableCell align="right">Loss (m)</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trails.map((trail) => (
              <TableRow key={trail.id} sx={{ opacity: trail.status === 'Deleted' ? 0.6 : 1, bgcolor: trail.status === 'Deleted' ? 'action.hover' : 'inherit' }}>
                <TableCell component="th" scope="row">{trail.name}</TableCell>
                <TableCell align="right">{(trail.length / 1000).toFixed(2)}</TableCell>
                <TableCell align="right">{Math.round(trail.elevationGain)}</TableCell>
                <TableCell align="right">{Math.round(trail.elevationLoss)}</TableCell>
                <TableCell>{trail.trailType}</TableCell>
                <TableCell>
                  {trail.locations?.map(l => l.name).join(', ') || 'N/A'}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={trail.status} 
                    color={trail.status === 'Published' ? 'success' : trail.status === 'Deleted' ? 'error' : 'default'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<MapIcon />} onClick={() => setSelectedTrailMap({ id: trail.id, name: trail.name })}>Map</Button>
                  {trail.status === 'Deleted' ? (
                    <Button size="small" color="success" startIcon={<RestoreIcon />} onClick={() => handleRestore(trail)}>Restore</Button>
                  ) : (
                    <>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => setSelectedTrailEdit(trail.id)}>Edit</Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => setTrailToDelete({ id: trail.id, name: trail.name })}>Delete</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {trails.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">No trails found. Upload a GPX to get started!</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={Boolean(selectedTrailMap)} 
        onClose={() => setSelectedTrailMap(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
            {selectedTrailMap?.name} - Trail Map
            <IconButton
                aria-label="close"
                onClick={() => setSelectedTrailMap(null)}
                sx={{ position: 'absolute', right: 8, top: 8 }}
            >
                <CloseIcon />
            </IconButton>
        </DialogTitle>
        <DialogContent dividers>
            {selectedTrailMap && <TrailMap trailId={selectedTrailMap.id} trailName={selectedTrailMap.name} />}
        </DialogContent>
      </Dialog>

      <TrailEditDialog 
        open={Boolean(selectedTrailEdit)} 
        trailId={selectedTrailEdit} 
        onClose={() => setSelectedTrailEdit(null)} 
        onSaveSuccess={() => {
            onNotify('Trail updated successfully');
            refresh();
        }}
      />

      <BulkUploadDialog 
        open={showBulkUpload} 
        onClose={() => setShowBulkUpload(false)} 
        onUploadSuccess={refresh}
        onNotify={onNotify}
      />

      <Dialog open={Boolean(trailToDelete)} onClose={() => setTrailToDelete(null)}>
        <DialogTitle>Delete Trail?</DialogTitle>
        <DialogContent>
            Are you sure you want to delete <strong>{trailToDelete?.name}</strong>? This action cannot be undone.
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setTrailToDelete(null)} disabled={deleting}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
            </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function BulkUploadDialog({ open, onClose, onUploadSuccess, onNotify }: { 
  open: boolean, 
  onClose: () => void, 
  onUploadSuccess: () => void, 
  onNotify: (message: string, severity?: 'success' | 'error') => void 
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Bulk Upload GPX Files
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
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

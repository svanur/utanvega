import { useState, useEffect } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, Alert, CircularProgress, MenuItem } from '@mui/material';
import { apiFetch } from '../hooks/api';

type TrailDetail = {
    id: string;
    name: string;
    slug: string;
    description: string;
    activityTypeId: string;
    status: string;
    difficulty: string;
    visibility: string;
};

const activityTypes = [
    { value: 'Running', label: 'Running' },
    { value: 'Cycling', label: 'Cycling' },
    { value: 'Hiking', label: 'Hiking' },
    { value: 'Skiing', label: 'Skiing' },
];

const trailStatuses = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Published', label: 'Published' },
    { value: 'Flagged', label: 'Flagged' },
    { value: 'Archived', label: 'Archived' },
];

const difficulties = [
    { value: 'Easy', label: 'Easy' },
    { value: 'Moderate', label: 'Moderate' },
    { value: 'Hard', label: 'Hard' },
    { value: 'Expert', label: 'Expert' },
    { value: 'Extreme', label: 'Extreme' },
];

const visibilities = [
    { value: 'Public', label: 'Public' },
    { value: 'Friends', label: 'Friends' },
    { value: 'Private', label: 'Private' },
];

export default function TrailEditDialog({ open, trailId, onClose, onSaveSuccess }: { open: boolean, trailId: string | null, onClose: () => void, onSaveSuccess: () => void }) {
    const [trail, setTrail] = useState<TrailDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && trailId) {
            const fetchTrail = async () => {
                try {
                    setLoading(true);
                    const data = await apiFetch<TrailDetail>(`/api/v1/admin/trails/${trailId}`);
                    setTrail(data);
                } catch (err) {
                    setError('Failed to load trail details.');
                } finally {
                    setLoading(false);
                }
            };
            fetchTrail();
        }
    }, [open, trailId]);

    const handleSave = async () => {
        if (!trail) return;
        try {
            setSaving(true);
            await apiFetch(`/api/v1/admin/trails/${trailId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: trail.id,
                    name: trail.name,
                    slug: trail.slug,
                    description: trail.description,
                    activityType: trail.activityTypeId,
                    status: trail.status,
                    difficulty: trail.difficulty,
                    visibility: trail.visibility,
                }),
            });
            onSaveSuccess();
            onClose();
        } catch (err) {
            setError('Failed to save trail.');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof TrailDetail, value: any) => {
        if (!trail) return;
        setTrail({ ...trail, [field]: value });
        if (field === 'name') {
            setTrail(prev => prev ? { ...prev, name: value, slug: value.toLowerCase().replace(/ /g, '-') } : null);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Edit Trail</DialogTitle>
            <DialogContent dividers>
                {loading ? <CircularProgress /> : trail ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField label="Name" fullWidth value={trail.name} onChange={(e) => handleChange('name', e.target.value)} />
                        <TextField label="Slug" fullWidth value={trail.slug} onChange={(e) => handleChange('slug', e.target.value)} />
                        <TextField label="Description" multiline rows={4} fullWidth value={trail.description || ''} onChange={(e) => handleChange('description', e.target.value)} />
                        
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField select label="Activity" value={trail.activityTypeId} onChange={(e) => handleChange('activityTypeId', e.target.value)}>
                                {activityTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                            </TextField>
                            <TextField select label="Status" value={trail.status} onChange={(e) => handleChange('status', e.target.value)}>
                                {trailStatuses.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                            </TextField>
                            <TextField select label="Difficulty" value={trail.difficulty} onChange={(e) => handleChange('difficulty', e.target.value)}>
                                {difficulties.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                            </TextField>
                            <TextField select label="Visibility" value={trail.visibility} onChange={(e) => handleChange('visibility', e.target.value)}>
                                {visibilities.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                            </TextField>
                        </Box>
                    </Box>
                ) : <Typography>Trail not found.</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={saving || !trail}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </DialogActions>
        </Dialog>
    );
}

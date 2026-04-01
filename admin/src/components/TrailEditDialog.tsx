import { useState, useEffect } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, Alert, CircularProgress, MenuItem, IconButton, Paper, Chip, Tabs, Tab } from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, History as HistoryIcon } from '@mui/icons-material';
import { apiFetch } from '../hooks/api';
import { useLocations, LocationDto } from '../hooks/useLocations';
import ChangeLogList from './ChangeLogList';
import { generateSlug } from '../utils/slugify';

type TrailLocationInfo = {
    locationId: string;
    role: 'Start' | 'End' | 'BelongsTo' | 'PassingThrough';
    order: number;
};

type TrailDetail = {
    id: string;
    name: string;
    slug: string;
    description: string;
    activityType: string;
    status: string;
    type: string;
    difficulty: string;
    visibility: string;
    locations: TrailLocationInfo[];
};

const roles = ['Start', 'End', 'BelongsTo', 'PassingThrough'];

const activityTypes = [
    { value: 'TrailRunning', label: 'Trail Running' },
    { value: 'Running', label: 'Running' },
    { value: 'Cycling', label: 'Cycling' },
    { value: 'Hiking', label: 'Hiking' },
];

const trailStatuses = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Published', label: 'Published' },
    { value: 'Flagged', label: 'Flagged' },
    { value: 'Archived', label: 'Archived' },
    { value: 'Deleted', label: 'Deleted' },
];

const difficulties = [
    { value: 'Easy', label: 'Easy' },
    { value: 'Moderate', label: 'Moderate' },
    { value: 'Hard', label: 'Hard' },
    { value: 'Expert', label: 'Expert' },
    { value: 'Extreme', label: 'Extreme' },
];

const trailTypes = [
    { value: 'OutAndBack', label: 'Out and Back' },
    { value: 'Loop', label: 'Loop' },
    { value: 'PointToPoint', label: 'Point to Point' },
];

const visibilities = [
    { value: 'Public', label: 'Public' },
    { value: 'Friends', label: 'Friends' },
    { value: 'Private', label: 'Private' },
];

export default function TrailEditDialog({ open, trailId, onClose, onSaveSuccess }: { open: boolean, trailId: string | null, onClose: () => void, onSaveSuccess: (trail?: { id: string, slug: string, name: string }) => void }) {
    const [trail, setTrail] = useState<TrailDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { locations: allLocations } = useLocations();

    const [newLocId, setNewLocId] = useState('');
    const [newLocRole, setNewLocRole] = useState<'Start' | 'End' | 'BelongsTo' | 'PassingThrough'>('PassingThrough');
    const [activeTab, setActiveTab] = useState(0);

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
                    activityType: trail.activityType,
                    status: trail.status,
                    type: trail.type,
                    difficulty: trail.difficulty,
                    visibility: trail.visibility,
                    updatedBy: 'admin', // Simple for now
                    locations: trail.locations.map(l => ({
                        locationId: l.locationId,
                        role: l.role,
                        order: l.order
                    }))
                }),
            });
            onSaveSuccess({ id: trail.id, slug: trail.slug, name: trail.name });
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
            setTrail(prev => prev ? { ...prev, name: value, slug: generateSlug(value) } : null);
        }
    };

    const handleAddLocation = () => {
        if (!trail || !newLocId) return;
        if (trail.locations.some(l => l.locationId === newLocId)) {
            setError('This location is already linked to this trail.');
            return;
        }
        const updatedLocations = [...trail.locations, { locationId: newLocId, role: newLocRole, order: trail.locations.length }];
        setTrail({ ...trail, locations: updatedLocations });
        setNewLocId('');
    };

    const handleRemoveLocation = (locId: string) => {
        if (!trail) return;
        const updatedLocations = trail.locations.filter(l => l.locationId !== locId);
        setTrail({ ...trail, locations: updatedLocations });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Edit Trail</Typography>
                    <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                        <Tab label="General" />
                        <Tab icon={<HistoryIcon />} label="History" />
                    </Tabs>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                {activeTab === 0 ? (
                    loading ? <CircularProgress /> : trail ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            {error && <Alert severity="error">{error}</Alert>}
                            <TextField label="Name" fullWidth value={trail.name} onChange={(e) => handleChange('name', e.target.value)} />
                            <TextField label="Slug" fullWidth value={trail.slug} onChange={(e) => handleChange('slug', e.target.value)} />
                            <TextField label="Description" multiline rows={4} fullWidth value={trail.description || ''} onChange={(e) => handleChange('description', e.target.value)} />
                            
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <TextField select label="Activity" value={trail.activityType} onChange={(e) => handleChange('activityType', e.target.value)}>
                                    {activityTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                <TextField select label="Status" value={trail.status} onChange={(e) => handleChange('status', e.target.value)}>
                                    {trailStatuses.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                                <TextField select label="Difficulty" value={trail.difficulty} onChange={(e) => handleChange('difficulty', e.target.value)}>
                                    {difficulties.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                <TextField select label="Visibility" value={trail.visibility} onChange={(e) => handleChange('visibility', e.target.value)}>
                                    {visibilities.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                <TextField select label="Trail Type" value={trail.type} onChange={(e) => handleChange('type', e.target.value)}>
                                    {trailTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                            </Box>

                            <Typography variant="subtitle1" sx={{ mt: 2 }}>Linked Locations</Typography>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    {trail.locations.map(tl => {
                                        const locName = allLocations.find(l => l.id === tl.locationId)?.name || 'Unknown';
                                        return (
                                            <Chip 
                                                key={tl.locationId}
                                                label={`${locName} (${tl.role})`}
                                                onDelete={() => handleRemoveLocation(tl.locationId)}
                                                color="primary"
                                                variant="outlined"
                                            />
                                        );
                                    })}
                                    {trail.locations.length === 0 && <Typography variant="body2" color="text.secondary">No locations linked.</Typography>}
                                </Box>
                                
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                    <TextField 
                                        select 
                                        label="Add Location" 
                                        size="small"
                                        value={newLocId} 
                                        onChange={(e) => setNewLocId(e.target.value)}
                                        sx={{ flexGrow: 1 }}
                                    >
                                        {allLocations.map(loc => (
                                            <MenuItem key={loc.id} value={loc.id}>{loc.name} ({loc.type})</MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField 
                                        select 
                                        label="Role" 
                                        size="small"
                                        value={newLocRole} 
                                        onChange={(e) => setNewLocRole(e.target.value as any)}
                                        sx={{ width: 150 }}
                                    >
                                        {roles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                                    </TextField>
                                    <Button 
                                        variant="outlined" 
                                        startIcon={<AddIcon />}
                                        onClick={handleAddLocation}
                                        sx={{ mt: 0.5 }}
                                    >
                                        Add
                                    </Button>
                                </Box>
                            </Paper>
                        </Box>
                    ) : <Typography>Trail not found.</Typography>
                ) : (
                    <ChangeLogList entityName="Trail" entityId={trailId || undefined} title="Trail History" />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                {activeTab === 0 && (
                    <Button onClick={handleSave} variant="contained" disabled={saving || !trail}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

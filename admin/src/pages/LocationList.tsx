import React, { useState } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Button, Typography, Box, CircularProgress, IconButton, Chip,
    Tooltip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { useLocations, LocationDto } from '../hooks/useLocations';
import { LocationDialog } from '../components/LocationDialog';
import { apiFetch } from '../hooks/api';

interface LocationListProps {
    onNotify: (message: string, severity: 'success' | 'error') => void;
}

export function LocationList({ onNotify }: LocationListProps) {
    const { locations, loading, error, refresh } = useLocations();
    const [selectedLocation, setSelectedLocation] = useState<LocationDto | undefined>();
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleEdit = (location: LocationDto) => {
        setSelectedLocation(location);
        setDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this location?')) return;
        try {
            await apiFetch(`/api/v1/admin/locations/${id}`, { method: 'DELETE' });
            onNotify('Location deleted successfully', 'success');
            refresh();
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to delete location', 'error');
        }
    };

    if (loading && !locations.length) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Locations</Typography>
                <Button 
                    variant="contained" 
                    startIcon={<AddIcon />}
                    onClick={() => { setSelectedLocation(undefined); setDialogOpen(true); }}
                >
                    New Location
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Parent</TableCell>
                            <TableCell>Spatial</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {locations.map((loc) => (
                            <TableRow key={loc.id}>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {loc.name}
                                        {loc.childrenCount > 0 && (
                                            <Tooltip title={`${loc.childrenCount} sub-locations`}>
                                                <Chip size="small" label={loc.childrenCount} icon={<ChevronRightIcon fontSize="small" />} />
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip size="small" label={loc.type} color="primary" variant="outlined" />
                                </TableCell>
                                <TableCell>{loc.parentName || '-'}</TableCell>
                                <TableCell>
                                    {loc.latitude && loc.longitude ? (
                                        <Typography variant="caption">
                                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                            {loc.radius ? ` (R: ${loc.radius}m)` : ''}
                                        </Typography>
                                    ) : '-'}
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleEdit(loc)} color="primary">
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(loc.id)} color="error">
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {locations.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">No locations found</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <LocationDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSaveSuccess={refresh}
                onNotify={onNotify}
                location={selectedLocation}
                allLocations={locations}
            />
        </Box>
    );
}

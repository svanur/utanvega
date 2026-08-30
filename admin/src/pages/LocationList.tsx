import React, { useState, useMemo, useCallback } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Button, Typography, Box, CircularProgress, IconButton, Chip,
    Tooltip, TextField, InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useLocations, LocationDto } from '../hooks/useLocations';
import { LocationDialog } from '../components/LocationDialog';
import { apiFetch } from '../hooks/api';

interface LocationListProps {
    onNotify: (message: string, severity: 'success' | 'error') => void;
}

interface TreeNode extends LocationDto {
    children: TreeNode[];
}

function buildTree(locations: LocationDto[]): TreeNode[] {
    const byId = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const loc of locations) {
        byId.set(loc.id, { ...loc, children: [] });
    }

    for (const node of byId.values()) {
        if (node.parentId && byId.has(node.parentId)) {
            byId.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    const sortByName = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name);
    function sortTree(nodes: TreeNode[]) {
        nodes.sort(sortByName);
        nodes.forEach(n => sortTree(n.children));
    }
    sortTree(roots);

    return roots;
}

const typeColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'primary' | 'secondary'> = {
    Country: 'error',
    Area: 'warning',
    Region: 'info',
    Municipality: 'success',
    Place: 'primary',
    Other: 'secondary',
};

const LocationTreeRow = React.memo(function LocationTreeRow({ node, depth, onEdit, onDelete, expanded, toggleExpand }: {
    node: TreeNode;
    depth: number;
    onEdit: (loc: LocationDto) => void;
    onDelete: (id: string) => void;
    expanded: Set<string>;
    toggleExpand: (id: string) => void;
}) {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
        <>
            <TableRow
                hover
                sx={{
                    bgcolor: depth === 0 ? 'action.hover' : 'transparent',
                    '& td': { borderBottom: hasChildren && isExpanded ? 'none' : undefined },
                }}
            >
                <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', pl: depth * 3 }}>
                        {hasChildren ? (
                            <IconButton size="small" onClick={() => toggleExpand(node.id)} sx={{ mr: 0.5 }}>
                                {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                            </IconButton>
                        ) : (
                            <Box sx={{ width: 30, mr: 0.5, display: 'flex', justifyContent: 'center' }}>
                                <LocationOnIcon fontSize="small" color="disabled" />
                            </Box>
                        )}
                        {hasChildren && isExpanded ? (
                            <FolderOpenIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                        ) : hasChildren ? (
                            <ChevronRightIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                        ) : null}
                        <Box>
                            <Typography variant="body2" fontWeight={hasChildren ? 'bold' : 'normal'}>
                                {node.name}
                            </Typography>
                            {/* Under the name rather than in its own column: the
                                tree's indentation already makes Name the widest
                                cell, and the slug is reference detail rather than
                                something to scan down. */}
                            <Typography variant="caption" color="text.disabled">
                                {node.slug}
                            </Typography>
                        </Box>
                    </Box>
                </TableCell>
                <TableCell>
                    <Chip
                        size="small"
                        label={node.type}
                        color={typeColors[node.type] || 'default'}
                        variant="outlined"
                    />
                </TableCell>
                <TableCell>
                    {node.latitude && node.longitude ? (
                        <Typography variant="caption">
                            {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                            {node.radius ? ` · R: ${node.radius >= 1000 ? `${(node.radius / 1000).toFixed(1)}km` : `${node.radius}m`}` : ''}
                        </Typography>
                    ) : (
                        <Typography variant="caption" color="text.disabled">No coordinates</Typography>
                    )}
                </TableCell>
                <TableCell align="center">
                    <Chip size="small" label={node.childrenCount} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => onEdit(node)} color="primary">
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => onDelete(node.id)} color="error">
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </TableCell>
            </TableRow>
            {hasChildren && isExpanded && node.children.map(child => (
                <LocationTreeRow
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    expanded={expanded}
                    toggleExpand={toggleExpand}
                />
            ))}
        </>
    );
});

export function LocationList({ onNotify }: LocationListProps) {
    const { locations, loading, error: _error, refresh } = useLocations();
    const [selectedLocation, setSelectedLocation] = useState<LocationDto | undefined>();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const tree = useMemo(() => buildTree(locations), [locations]);

    // Flat search results with parent name for context
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        const byId = new Map(locations.map(l => [l.id, l]));
        const parentMap = new Map<string, string>();
        for (const loc of locations) {
            if (loc.parentId) {
                const parent = byId.get(loc.parentId);
                if (parent) parentMap.set(loc.id, parent.name);
            }
        }
        return locations
            .filter(loc =>
                loc.name.toLowerCase().includes(q) ||
                loc.type.toLowerCase().includes(q)
            )
            .map(loc => ({ loc, parentName: parentMap.get(loc.id) ?? null }))
            .sort((a, b) => a.loc.name.localeCompare(b.loc.name));
    }, [locations, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    const toggleExpand = useCallback((id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setExpanded(new Set(locations.filter(l => l.childrenCount > 0).map(l => l.id)));
    }, [locations]);

    const collapseAll = useCallback(() => setExpanded(new Set()), []);

    const handleEdit = useCallback((location: LocationDto) => {
        setSelectedLocation(location);
        setDialogOpen(true);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this location?')) return;
        try {
            await apiFetch(`/api/v1/admin/locations/${id}`, { method: 'DELETE' });
            onNotify('Location deleted successfully', 'success');
            refresh();
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to delete location', 'error');
        }
    }, [onNotify, refresh]);

    if (loading && !locations.length) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h4">Locations</Typography>
                    <Chip label={isSearching ? `${searchResults.length} / ${locations.length}` : locations.length} size="small" />
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => { setSelectedLocation(undefined); setDialogOpen(true); }}
                >
                    New Location
                </Button>
            </Box>

            {/* Search and list controls in their own bar below the header, left
                aligned, matching the events and trails pages. Creating a location
                stays top right — it is an action, not a filter. */}
            <Paper sx={{ mb: 3, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    placeholder="Search locations…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    sx={{ minWidth: 200, flexGrow: 1, maxWidth: 300 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                        endAdornment: searchQuery ? (
                            <InputAdornment position="end">
                                <IconButton size="small" aria-label="Clear search" onClick={() => setSearchQuery('')}>
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ) : undefined,
                    }}
                />
                {!isSearching && <>
                    <Button size="small" onClick={expandAll}>Expand All</Button>
                    <Button size="small" onClick={collapseAll}>Collapse All</Button>
                </>}
            </Paper>

            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Coordinates</TableCell>
                            <TableCell align="center">Children</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isSearching ? (
                            searchResults.length > 0 ? searchResults.map(({ loc, parentName }) => (
                                <TableRow key={loc.id} hover>
                                    <TableCell>
                                        <Box>
                                            <Typography variant="body2">{loc.name}</Typography>
                                            {parentName && (
                                                <Typography variant="caption" color="text.secondary">
                                                    in {parentName}
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="small" label={loc.type} color={typeColors[loc.type] || 'default'} variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        {loc.latitude != null && loc.longitude != null ? (
                                            <Typography variant="caption">
                                                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                                {loc.radius ? ` · R: ${loc.radius >= 1000 ? `${(loc.radius / 1000).toFixed(1)}km` : `${loc.radius}m`}` : ''}
                                            </Typography>
                                        ) : (
                                            <Typography variant="caption" color="text.disabled">No coordinates</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip size="small" label={loc.childrenCount} variant="outlined" />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => handleEdit(loc)} color="primary">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" onClick={() => handleDelete(loc.id)} color="error">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} align="center">No locations match "{searchQuery}"</TableCell>
                                </TableRow>
                            )
                        ) : (
                            <>
                                {tree.map(node => (
                                    <LocationTreeRow
                                        key={node.id}
                                        node={node}
                                        depth={0}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        expanded={expanded}
                                        toggleExpand={toggleExpand}
                                    />
                                ))}
                                {tree.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">No locations found</TableCell>
                                    </TableRow>
                                )}
                            </>
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

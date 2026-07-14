import {
    Alert,
    Box,
    Chip,
    Link,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    TextField,
    InputAdornment,
} from '@mui/material';
import PoolIcon from '@mui/icons-material/Pool';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useState, useMemo } from 'react';
import poolsData from '../data/pools.json';

interface Pool {
    id: string;
    name: string;
    type: 'municipal' | 'spa' | 'natural';
    locationSlug: string;
    coordinates: { lat: number; lng: number };
    url: string;
    amenities: { hot_tubs: boolean; sauna: boolean; showers: boolean; changing_rooms: boolean };
    access: { is_paid: boolean; requires_hiking: boolean; requires_4wd: boolean };
}

const pools = poolsData as Pool[];

const TYPE_COLOR: Record<string, 'primary' | 'secondary' | 'success'> = {
    municipal: 'primary',
    spa: 'secondary',
    natural: 'success',
};

const TYPE_LABEL: Record<string, string> = {
    municipal: 'Municipal',
    spa: 'Spa',
    natural: 'Natural',
};

export default function PoolsPage() {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return pools;
        return pools.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.locationSlug.toLowerCase().includes(q) ||
            p.type.includes(q)
        );
    }, [search]);

    const counts = useMemo(() => ({
        municipal: pools.filter(p => p.type === 'municipal').length,
        spa: pools.filter(p => p.type === 'spa').length,
        natural: pools.filter(p => p.type === 'natural').length,
    }), []);

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto', p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <PoolIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>Pools in Iceland</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Read-only reference for all pools in the dataset. To add or edit pools, update{' '}
                <code>frontend/data/pools.json</code>.
            </Typography>
            <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
                Pools are shown on trail and location pages when the feature flag <strong>pools</strong> is enabled. Toggle it on the <strong>Features</strong> page.
            </Alert>

            {/* Summary chips */}
            <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                <Chip label={`${pools.length} total`} size="small" />
                <Chip label={`${counts.municipal} municipal`} size="small" color="primary" variant="outlined" />
                <Chip label={`${counts.spa} spa`} size="small" color="secondary" variant="outlined" />
                <Chip label={`${counts.natural} natural`} size="small" color="success" variant="outlined" />
            </Stack>

            {/* Search */}
            <TextField
                size="small"
                placeholder="Filter by name, location slug or type…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ mb: 2, width: 360 }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                }}
            />

            <Paper variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Location slug</TableCell>
                            <TableCell>Coordinates</TableCell>
                            <TableCell>Amenities</TableCell>
                            <TableCell>Access</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map(pool => (
                            <TableRow key={pool.id} hover>
                                <TableCell>
                                    <Link
                                        href={pool.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant="body2"
                                        fontWeight={600}
                                        underline="hover"
                                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                                    >
                                        {pool.name}
                                        <OpenInNewIcon sx={{ fontSize: 11 }} />
                                    </Link>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontFamily: 'monospace' }}>
                                        {pool.id}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={TYPE_LABEL[pool.type] ?? pool.type}
                                        size="small"
                                        color={TYPE_COLOR[pool.type] ?? 'default'}
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                        {pool.locationSlug}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                        {pool.coordinates.lat.toFixed(4)}, {pool.coordinates.lng.toFixed(4)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                        {pool.amenities.hot_tubs && <Chip label="Hot tubs" size="small" sx={{ height: 18, fontSize: 11 }} />}
                                        {pool.amenities.sauna && <Chip label="Sauna" size="small" sx={{ height: 18, fontSize: 11 }} />}
                                        {pool.amenities.showers && <Chip label="Showers" size="small" sx={{ height: 18, fontSize: 11 }} />}
                                    </Stack>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                        {!pool.access.is_paid && <Chip label="Free" size="small" color="success" sx={{ height: 18, fontSize: 11 }} />}
                                        {pool.access.requires_hiking && <Chip label="Hiking" size="small" sx={{ height: 18, fontSize: 11 }} />}
                                        {pool.access.requires_4wd && <Chip label="4WD" size="small" sx={{ height: 18, fontSize: 11 }} />}
                                        {pool.access.is_paid && !pool.access.requires_hiking && !pool.access.requires_4wd && (
                                            <Typography variant="caption" color="text.secondary">—</Typography>
                                        )}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                    <Typography variant="body2" color="text.secondary">No pools match "{search}"</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>
            {filtered.length > 0 && search && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Showing {filtered.length} of {pools.length} pools
                </Typography>
            )}
        </Box>
    );
}

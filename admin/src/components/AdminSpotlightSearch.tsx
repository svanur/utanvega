import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Dialog,
    InputBase,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Box,
    Chip,
    Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import FilterListIcon from '@mui/icons-material/FilterList';
import { apiFetch } from '../hooks/api';

interface Trail {
    id: string;
    name: string;
    slug: string;
    status: string;
    activityType: string;
    trailType: string;
}

interface Location {
    id: string;
    name: string;
    slug: string;
    type: string;
}

interface SearchResult {
    type: 'trail' | 'location';
    id: string;
    name: string;
    slug: string;
    subtitle?: string;
}

interface AdminSpotlightSearchProps {
    onEditTrail: (id: string) => void;
    onNavigate: (page: string) => void;
    onFilterTrails: (search: string) => void;
}

function normalizeIcelandic(s: string): string {
    return s
        .toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ý/g, 'y')
        .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae')
        .replace(/ö/g, 'o');
}

function scoreMatch(query: string, name: string, slug: string): number {
    const q = normalizeIcelandic(query);
    const n = normalizeIcelandic(name);
    const s = slug.toLowerCase();
    if (n === q || s === q) return 100;
    if (n.startsWith(q) || s.startsWith(q)) return 80;
    const words = n.split(/\s+/);
    if (words.some(w => w.startsWith(q))) return 60;
    if (n.includes(q) || s.includes(q)) return 40;
    return 0;
}

export default function AdminSpotlightSearch({ onEditTrail, onNavigate, onFilterTrails }: AdminSpotlightSearchProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [trails, setTrails] = useState<Trail[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loaded, setLoaded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!open || loaded) return;
        Promise.all([
            apiFetch<Trail[]>('/api/v1/admin/trails'),
            apiFetch<Location[]>('/api/v1/locations'),
        ]).then(([trailData, locationData]) => {
            setTrails(trailData);
            setLocations(locationData);
            setLoaded(true);
        }).catch(() => {
            setLoaded(true);
        });
    }, [open, loaded]);

    const results = useMemo((): SearchResult[] => {
        if (!query.trim()) return [];
        const q = query.trim();

        const trailResults: (SearchResult & { score: number })[] = trails
            .map(trail => ({
                type: 'trail' as const,
                id: trail.id,
                name: trail.name,
                slug: trail.slug,
                subtitle: `/${trail.slug} · ${trail.status} · ${trail.activityType}`,
                score: scoreMatch(q, trail.name, trail.slug),
            }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);

        const locationResults: (SearchResult & { score: number })[] = locations
            .map(loc => ({
                type: 'location' as const,
                id: loc.id,
                name: loc.name,
                slug: loc.slug,
                subtitle: `${loc.type}`,
                score: scoreMatch(q, loc.name, loc.slug),
            }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);

        return [...trailResults.slice(0, 7), ...locationResults.slice(0, 3)];
    }, [query, trails, locations]);

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value);
        setActiveIndex(0);
    }, []);

    const handleSelect = useCallback((result: SearchResult) => {
        setOpen(false);
        setQuery('');
        if (result.type === 'trail') {
            onEditTrail(result.id);
        } else {
            onNavigate('locations');
        }
    }, [onEditTrail, onNavigate]);

    const handleFilterTrails = useCallback(() => {
        const term = query.trim();
        setOpen(false);
        setQuery('');
        onFilterTrails(term);
    }, [query, onFilterTrails]);

    const totalItems = results.length + (query.trim() ? 1 : 0); // +1 for "Filter trail list" action

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, totalItems - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex < results.length && results[activeIndex]) {
                handleSelect(results[activeIndex]);
            } else if (activeIndex === results.length && query.trim()) {
                handleFilterTrails();
            }
        }
    }, [results, activeIndex, handleSelect, totalItems, query, handleFilterTrails]);

    useEffect(() => {
        if (!listRef.current) return;
        const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
        activeEl?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const handleClose = () => {
        setOpen(false);
        setQuery('');
    };

    const trailResults = results.filter(r => r.type === 'trail');
    const locationResults = results.filter(r => r.type === 'location');

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    position: 'fixed',
                    top: '15%',
                    m: 0,
                    maxHeight: '60vh',
                    borderRadius: 2,
                    overflow: 'hidden',
                },
            }}
            slotProps={{
                backdrop: { sx: { backdropFilter: 'blur(4px)' } },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, gap: 1, borderBottom: 1, borderColor: 'divider' }}>
                <SearchIcon sx={{ color: 'text.secondary' }} />
                <InputBase
                    inputRef={inputRef}
                    autoFocus
                    fullWidth
                    placeholder="Search trails and locations..."
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    sx={{ fontSize: '1.1rem' }}
                />
                <Chip
                    label="ESC"
                    size="small"
                    variant="outlined"
                    onClick={handleClose}
                    sx={{ cursor: 'pointer', fontSize: '0.7rem', height: 22 }}
                />
            </Box>

            {results.length > 0 ? (
                <List ref={listRef} dense sx={{ py: 0, maxHeight: '45vh', overflow: 'auto' }}>
                    {trailResults.length > 0 && (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                                Trails
                            </Typography>
                            {trailResults.map((result, i) => (
                                <ListItemButton
                                    key={`trail-${result.id}`}
                                    data-index={i}
                                    selected={activeIndex === i}
                                    onClick={() => handleSelect(result)}
                                    sx={{ py: 0.5 }}
                                >
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <DashboardIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={result.name}
                                        secondary={result.subtitle}
                                        primaryTypographyProps={{ noWrap: true }}
                                        secondaryTypographyProps={{ noWrap: true, variant: 'caption', fontFamily: 'monospace' }}
                                    />
                                    {activeIndex === i && (
                                        <KeyboardReturnIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
                                    )}
                                </ListItemButton>
                            ))}
                        </>
                    )}

                    {trailResults.length > 0 && locationResults.length > 0 && <Divider />}

                    {locationResults.length > 0 && (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                                Locations
                            </Typography>
                            {locationResults.map((result, i) => {
                                const globalIndex = trailResults.length + i;
                                return (
                                    <ListItemButton
                                        key={`loc-${result.id}`}
                                        data-index={globalIndex}
                                        selected={activeIndex === globalIndex}
                                        onClick={() => handleSelect(result)}
                                        sx={{ py: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <LocationOnIcon fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={result.name}
                                            secondary={result.subtitle}
                                            primaryTypographyProps={{ noWrap: true }}
                                            secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                                        />
                                        {activeIndex === globalIndex && (
                                            <KeyboardReturnIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
                                        )}
                                    </ListItemButton>
                                );
                            })}
                        </>
                    )}

                    {query.trim() && (
                        <>
                            <Divider />
                            <ListItemButton
                                data-index={results.length}
                                selected={activeIndex === results.length}
                                onClick={handleFilterTrails}
                                sx={{ py: 0.5 }}
                            >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <FilterListIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={`Filter trail list by "${query.trim()}"`}
                                    primaryTypographyProps={{ noWrap: true, fontStyle: 'italic' }}
                                />
                                {activeIndex === results.length && (
                                    <KeyboardReturnIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
                                )}
                            </ListItemButton>
                        </>
                    )}
                </List>
            ) : query.trim() ? (
                <List ref={listRef} dense sx={{ py: 0 }}>
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography color="text.secondary" variant="body2">No matching results</Typography>
                    </Box>
                    <Divider />
                    <ListItemButton
                        data-index={0}
                        selected={activeIndex === 0}
                        onClick={handleFilterTrails}
                        sx={{ py: 0.5 }}
                    >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                            <FilterListIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                            primary={`Filter trail list by "${query.trim()}"`}
                            primaryTypographyProps={{ noWrap: true, fontStyle: 'italic' }}
                        />
                        {activeIndex === 0 && (
                            <KeyboardReturnIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
                        )}
                    </ListItemButton>
                </List>
            ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">Start typing to search trails and locations</Typography>
                </Box>
            )}
        </Dialog>
    );
}

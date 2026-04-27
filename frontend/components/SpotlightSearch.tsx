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
    CircularProgress,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HikingIcon from '@mui/icons-material/Hiking';
import PlaceIcon from '@mui/icons-material/Place';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API_URL, Trail } from '../hooks/useTrails';
import { Location } from '../hooks/useLocations';
import { CompetitionSummary } from '../hooks/useCompetitions';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

interface SearchResult {
    type: 'trail' | 'location' | 'competition';
    name: string;
    slug: string;
    subtitle?: string;
}

function normalizeIcelandic(s: string): string {
    return s
        .toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ý/g, 'y')
        .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae')
        .replace(/ö/g, 'o');
}

function scoreMatch(query: string, name: string): number {
    const q = normalizeIcelandic(query);
    const n = normalizeIcelandic(name);
    if (n === q) return 100;
    if (n.startsWith(q)) return 80;
    const words = n.split(/\s+/);
    if (words.some(w => w.startsWith(q))) return 60;
    if (n.includes(q)) return 40;
    return 0;
}

function formatDistance(meters: number): string {
    return `${(meters / 1000).toFixed(1)} km`;
}

export default function SpotlightSearch() {
    const [open, setOpen] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('search') === 'true') {
            // Clean up the URL param after reading
            params.delete('search');
            const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            return true;
        }
        return false;
    });
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [trails, setTrails] = useState<Trail[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
    const [loaded, setLoaded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { isEnabled } = useFeatureFlags();
    const racesEnabled = isEnabled('races_page');
    const locationsEnabled = isEnabled('locations_page');
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Don't render on mobile (no keyboard)
    // Actually, let's still render — users with bluetooth keyboards exist.
    // We just won't show the Ctrl+K hint on mobile.

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

    // Fetch data on first open
    useEffect(() => {
        if (!open || loaded) return;
        const fetches: Promise<unknown>[] = [
            fetch(`${API_URL}/api/v1/trails`).then(r => r.json()),
        ];
        if (locationsEnabled) {
            fetches.push(fetch(`${API_URL}/api/v1/locations`).then(r => r.json()));
        }
        if (racesEnabled) {
            fetches.push(fetch(`${API_URL}/api/v1/competitions`).then(r => r.json()));
        }
        Promise.all(fetches).then(([trailData, locationData, competitionData]) => {
            setTrails(trailData as Trail[]);
            if (locationsEnabled && locationData) setLocations(locationData as Location[]);
            if (racesEnabled && competitionData) setCompetitions(competitionData as CompetitionSummary[]);
            setLoaded(true);
        }).catch(() => {
            setLoaded(true);
        });
    }, [open, loaded, racesEnabled, locationsEnabled]);

    const results = useMemo((): SearchResult[] => {
        if (!query.trim()) return [];
        const q = query.trim();

        const trailResults: (SearchResult & { score: number })[] = trails
            .map(trail => ({
                type: 'trail' as const,
                name: trail.name,
                slug: trail.slug,
                subtitle: `${formatDistance(trail.length)} · ${Math.round(trail.elevationGain)}m ↑`,
                score: scoreMatch(q, trail.name),
            }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);

        const locationResults: (SearchResult & { score: number })[] = locations
            .map(loc => ({
                type: 'location' as const,
                name: loc.name,
                slug: loc.slug,
                subtitle: loc.parentName ? `${loc.parentName} · ${loc.trailsCount} ${t('spotlight.trails')}` : `${loc.trailsCount} ${t('spotlight.trails')}`,
                score: scoreMatch(q, loc.name),
            }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);

        const competitionResults: (SearchResult & { score: number })[] = racesEnabled
            ? competitions
                .map(comp => ({
                    type: 'competition' as const,
                    name: comp.name,
                    slug: comp.slug,
                    subtitle: comp.nextDate
                        ? new Date(comp.nextDate + 'T00:00:00').toLocaleDateString(i18n.language === 'is' ? 'is-IS' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                        : (comp.organizerName ?? comp.locationName ?? undefined),
                    score: scoreMatch(q, comp.name),
                }))
                .filter(r => r.score > 0)
                .sort((a, b) => b.score - a.score)
            : [];

        return [...trailResults.slice(0, 5), ...locationResults.slice(0, 3), ...competitionResults.slice(0, 3)];
    }, [query, trails, locations, competitions, racesEnabled, i18n.language, t]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const handleSelect = useCallback((result: SearchResult) => {
        setOpen(false);
        setQuery('');
        if (result.type === 'trail') {
            navigate(`/trails/${result.slug}`);
        } else if (result.type === 'location') {
            navigate(`/locations/${result.slug}`);
        } else {
            navigate(`/races/${result.slug}`);
        }
    }, [navigate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[activeIndex]) {
            e.preventDefault();
            handleSelect(results[activeIndex]);
        }
    }, [results, activeIndex, handleSelect]);

    // Scroll active item into view
    useEffect(() => {
        if (!listRef.current) return;
        const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
        activeEl?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const handleClose = () => {
        setOpen(false);
        setQuery('');
    };

    // Group results for display
    const trailResults = results.filter(r => r.type === 'trail');
    const locationResults = results.filter(r => r.type === 'location');
    const competitionResults = results.filter(r => r.type === 'competition');

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    position: 'fixed',
                    top: isMobile ? '10%' : '20%',
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
            {/* Search input */}
            <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, gap: 1, borderBottom: 1, borderColor: 'divider' }}>
                <SearchIcon sx={{ color: 'text.secondary' }} />
                <InputBase
                    inputRef={inputRef}
                    autoFocus
                    fullWidth
                    placeholder={t('spotlight.placeholder')}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
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

            {/* Results */}
            {!loaded ? (
                <Box sx={{ p: 3, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                    <CircularProgress size={18} />
                    <Typography color="text.secondary" variant="body2">{t('spotlight.loading')}</Typography>
                </Box>
            ) : results.length > 0 ? (
                <List ref={listRef} dense sx={{ py: 0, maxHeight: '45vh', overflow: 'auto' }}>
                    {trailResults.length > 0 && (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                                {t('spotlight.trailsSection')}
                            </Typography>
                            {trailResults.map((result, i) => {
                                const globalIndex = i;
                                return (
                                    <ListItemButton
                                        key={`trail-${result.slug}`}
                                        data-index={globalIndex}
                                        selected={activeIndex === globalIndex}
                                        onClick={() => handleSelect(result)}
                                        sx={{ py: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <HikingIcon fontSize="small" />
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

                    {trailResults.length > 0 && locationResults.length > 0 && <Divider />}

                    {locationResults.length > 0 && (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                                {t('spotlight.locationsSection')}
                            </Typography>
                            {locationResults.map((result, i) => {
                                const globalIndex = trailResults.length + i;
                                return (
                                    <ListItemButton
                                        key={`loc-${result.slug}`}
                                        data-index={globalIndex}
                                        selected={activeIndex === globalIndex}
                                        onClick={() => handleSelect(result)}
                                        sx={{ py: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <PlaceIcon fontSize="small" />
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

                    {(locationResults.length > 0 || trailResults.length > 0) && competitionResults.length > 0 && <Divider />}

                    {competitionResults.length > 0 && (
                        <>
                            <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                                {t('spotlight.racesSection')}
                            </Typography>
                            {competitionResults.map((result, i) => {
                                const globalIndex = trailResults.length + locationResults.length + i;
                                return (
                                    <ListItemButton
                                        key={`comp-${result.slug}`}
                                        data-index={globalIndex}
                                        selected={activeIndex === globalIndex}
                                        onClick={() => handleSelect(result)}
                                        sx={{ py: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <EmojiEventsIcon fontSize="small" />
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
                </List>
            ) : query.trim() ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">{t('spotlight.noResults')}</Typography>
                </Box>
            ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">{t('spotlight.hint')}</Typography>
                </Box>
            )}
        </Dialog>
    );
}

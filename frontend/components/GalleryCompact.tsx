import { useState } from 'react';
import { Badge, Box, Button, Chip, IconButton, Link, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useLocalize } from '../utils/localize';
import { galleryLabel, sortedGalleries } from '../utils/galleryLabel';
import type { PublicPhotoGallery } from '../hooks/useEvents';

interface GalleryCompactProps {
    galleries: PublicPhotoGallery[];
    /** 'icon' is a bare IconButton for a dense table cell; 'button' is a labelled outlined Button
     *  for a card/list row, styled like the neighbouring results Button; 'chip' is an outlined Chip
     *  matching GalleryLinks' chip styling, for a row of other Chips (e.g. date/race-count/results). */
    variant: 'icon' | 'button' | 'chip';
}

// Single entry point for a dense row: exactly one gallery opens directly in a new tab, same as
// the neighbouring results link. 2+ galleries collapse behind a count badge that opens a menu
// instead of fanning out into several buttons/icons — that's what keeps a 3-4 gallery row from
// growing into a multi-line block on a phone. Used wherever a card/table row needs one gallery
// control regardless of gallery count (EditionsHistoryPage, RacesPage's events list, and
// CompetitionDetailPage's editions-history grid). The primary/current edition's own action row
// has room to spare and still uses GalleryLinks' one-per-gallery fan-out instead.
export default function GalleryCompact({ galleries, variant }: GalleryCompactProps) {
    const { t } = useTranslation();
    const loc = useLocalize();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    if (galleries.length === 0) return null;

    const sorted = sortedGalleries(galleries);

    if (sorted.length === 1) {
        const g = sorted[0];
        const label = galleryLabel(g, loc, t);
        const attribution = g.photographerName
            ? t('races.photoBy', { name: g.photographerName, defaultValue: `Photo: ${g.photographerName}` })
            : null;

        if (variant === 'icon') {
            return (
                <Tooltip title={attribution ? `${label} — ${attribution}` : label}>
                    <IconButton size="small" component="a" href={g.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <PhotoCameraIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            );
        }

        if (variant === 'chip') {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Chip
                        icon={<PhotoCameraIcon />}
                        label={label}
                        size="small"
                        variant="outlined"
                        clickable
                        component="a"
                        href={g.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                    />
                    {g.photographerName && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                            {t('races.photoByPrefix', { defaultValue: 'Photo:' })}{' '}
                            {g.photographerSlug ? (
                                <Link
                                    component={RouterLink}
                                    to={`/photographers/${g.photographerSlug}`}
                                    color="inherit"
                                    underline="hover"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {g.photographerName}
                                </Link>
                            ) : (
                                g.photographerName
                            )}
                        </Typography>
                    )}
                </Box>
            );
        }

        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Button
                    size="small"
                    variant="outlined"
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<PhotoCameraIcon sx={{ fontSize: 14 }} />}
                    onClick={e => e.stopPropagation()}
                    sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                >
                    {label}
                </Button>
                {g.photographerName && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {t('races.photoByPrefix', { defaultValue: 'Photo:' })}{' '}
                        {g.photographerSlug ? (
                            <Link
                                component={RouterLink}
                                to={`/photographers/${g.photographerSlug}`}
                                color="inherit"
                                underline="hover"
                                onClick={e => e.stopPropagation()}
                            >
                                {g.photographerName}
                            </Link>
                        ) : (
                            g.photographerName
                        )}
                    </Typography>
                )}
            </Box>
        );
    }

    const openMenu = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
    };
    const closeMenu = () => setAnchorEl(null);
    const countLabel = t('races.galleryCount', { count: sorted.length, defaultValue: `${sorted.length} galleries` });

    return (
        <>
            {variant === 'icon' ? (
                <Tooltip title={countLabel}>
                    <IconButton size="small" onClick={openMenu} aria-label={countLabel}>
                        <Badge badgeContent={sorted.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 14, minWidth: 14 } }}>
                            <PhotoCameraIcon fontSize="small" />
                        </Badge>
                    </IconButton>
                </Tooltip>
            ) : variant === 'chip' ? (
                <Chip
                    icon={<PhotoCameraIcon />}
                    label={countLabel}
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={openMenu}
                />
            ) : (
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoCameraIcon sx={{ fontSize: 14 }} />}
                    onClick={openMenu}
                    sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                >
                    {countLabel}
                </Button>
            )}
            <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu} onClick={e => e.stopPropagation()}>
                {sorted.map(g => (
                    <MenuItem key={g.url} component="a" href={g.url} target="_blank" rel="noopener noreferrer" onClick={closeMenu}>
                        <Box>
                            <Typography variant="body2">{galleryLabel(g, loc, t)}</Typography>
                            {g.photographerName && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {t('races.photoByPrefix', { defaultValue: 'Photo:' })}{' '}
                                    {g.photographerSlug ? (
                                        // The MenuItem itself is an <a> (component="a", href={g.url}) so a
                                        // nested RouterLink/<a> here would be invalid HTML and would break
                                        // click targeting. Navigate imperatively instead of nesting an anchor.
                                        <Box
                                            component="span"
                                            onClick={e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                closeMenu();
                                                navigate(`/photographers/${g.photographerSlug}`);
                                            }}
                                            sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                                        >
                                            {g.photographerName}
                                        </Box>
                                    ) : (
                                        g.photographerName
                                    )}
                                </Typography>
                            )}
                        </Box>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

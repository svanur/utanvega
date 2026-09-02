import { Box, Button, Chip, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import { useLocalize } from '../utils/localize';
import { galleryLabel, sortedGalleries } from '../utils/galleryLabel';
import type { PublicPhotoGallery } from '../hooks/useEvents';

interface GalleryLinksProps {
    galleries: PublicPhotoGallery[];
    /** 'button' matches the outlined action-row Button; 'chip' matches an inline Chip row. */
    variant?: 'button' | 'chip';
    size?: 'small' | 'medium';
    /** Set when the link sits inside a clickable card/row that would otherwise navigate on click. */
    stopPropagation?: boolean;
}

// One link per gallery, ordered by sortOrder, each with a photographer attribution caption when
// one is on record — renders nothing for an empty array so callers can drop it in unconditionally.
// A single gallery renders as one Button/Chip, matching the pre-#491 single-URL look;
// 2+ galleries fan out into that many links side by side (fine here — every call site already
// wraps its action row). EditionsHistoryPage.tsx is the one exception dense enough to need a
// count-collapsed treatment instead; see GalleryCompact for that.
export default function GalleryLinks({ galleries, variant = 'button', size = 'small', stopPropagation }: GalleryLinksProps) {
    const { t } = useTranslation();
    const loc = useLocalize();

    if (galleries.length === 0) return null;

    const handleClick = stopPropagation ? (e: React.MouseEvent) => e.stopPropagation() : undefined;

    return (
        <>
            {sortedGalleries(galleries).map(g => {
                const label = galleryLabel(g, loc, t);
                const attribution = g.photographerName
                    ? t('races.photoBy', { name: g.photographerName, defaultValue: `Photo: ${g.photographerName}` })
                    : null;
                return (
                    <Box key={g.url} sx={{ display: 'flex', flexDirection: 'column', alignItems: variant === 'chip' ? 'flex-start' : 'center' }}>
                        {variant === 'chip' ? (
                            <Chip
                                icon={<PhotoCameraIcon />}
                                label={label}
                                size={size}
                                variant="outlined"
                                clickable
                                component="a"
                                href={g.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={handleClick}
                            />
                        ) : (
                            <Button
                                variant="outlined"
                                size={size}
                                startIcon={<PhotoCameraIcon sx={{ fontSize: 14 }} />}
                                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                href={g.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={handleClick}
                                sx={{ textTransform: 'none' }}
                            >
                                {label}
                            </Button>
                        )}
                        {attribution && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.68rem' }}>
                                {attribution}
                            </Typography>
                        )}
                    </Box>
                );
            })}
        </>
    );
}

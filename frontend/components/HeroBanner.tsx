import { useState, useMemo } from 'react';
import { Box, Checkbox, Collapse, FormControlLabel, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { QuoteService } from '../services/QuoteService';
import { getRandomHeroBannerPhoto } from '../data/heroBannerPhotos';

export default function HeroBanner() {
    const [isVisible, setIsVisible] = useState(() => localStorage.getItem('hideSplash') !== 'true');
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const { t } = useTranslation();

    const quote = useMemo(() => QuoteService.getRandomQuote(), []);
    const photo = useMemo(() => getRandomHeroBannerPhoto(), []);

    const handleClose = () => {
        if (dontShowAgain) localStorage.setItem('hideSplash', 'true');
        setIsVisible(false);
    };

    return (
        <Collapse in={isVisible} unmountOnExit>
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    height: { xs: 220, sm: 320, md: 420 },
                    overflow: 'hidden',
                    borderRadius: 2,
                    mb: 3,
                }}
            >
                {/* Photo */}
                <Box
                    component="img"
                    src={photo.src}
                    alt={photo.alt}
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: photo.objectPosition ?? 'center',
                        display: 'block',
                    }}
                />

                {/* Gradient overlay for text legibility */}
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)',
                    }}
                />

                {/* Quote */}
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: { xs: 36, sm: 44 },
                        left: { xs: 16, sm: 28 },
                        right: { xs: 16, sm: 28 },
                    }}
                >
                    <Typography
                        variant="h6"
                        component="blockquote"
                        sx={{
                            color: '#fff',
                            fontStyle: 'italic',
                            fontWeight: 500,
                            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                            m: 0,
                            fontSize: { xs: '0.95rem', sm: '1.15rem', md: '1.3rem' },
                        }}
                    >
                        "{quote.text}"
                    </Typography>
                    {quote.author && (
                        <Typography
                            variant="body2"
                            sx={{
                                color: 'rgba(255,255,255,0.8)',
                                mt: 0.5,
                                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                            }}
                        >
                            — {quote.author}
                        </Typography>
                    )}
                </Box>

                {/* Photo credit */}
                <Box
                    component="a"
                    href={photo.creditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                        position: 'absolute',
                        bottom: 6,
                        right: 10,
                        color: 'rgba(255,255,255,0.65)',
                        fontSize: '0.65rem',
                        textDecoration: 'none',
                        '&:hover': { color: '#fff' },
                    }}
                >
                    {t('hero.photoCredit')}: {photo.credit}
                </Box>

                {/* Dismiss controls */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0,
                        background: 'rgba(0,0,0,0.35)',
                        borderRadius: 2,
                        px: 0.5,
                    }}
                >
                    <FormControlLabel
                        control={
                            <Checkbox
                                size="small"
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                                sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#fff' } }}
                            />
                        }
                        label={
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.7rem' }}>
                                {t('header.dontShowAgain')}
                            </Typography>
                        }
                        sx={{ mr: 0 }}
                    />
                    <IconButton onClick={handleClose} size="small" aria-label="close" sx={{ color: '#fff' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
        </Collapse>
    );
}

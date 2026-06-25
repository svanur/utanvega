import { Box, Link, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { HeroTheme } from '../data/heroThemes';

interface HeroBandProps {
    theme: HeroTheme;
    isDark: boolean;
}

function getDaysUntil(theme: HeroTheme): number | null {
    if (!theme.recurring) return null;
    const { month, day } = theme.recurring;
    const now = new Date();
    const raceDay = new Date(now.getFullYear(), month - 1, day);
    const diffMs = raceDay.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function HeroBand({ theme, isDark }: HeroBandProps) {
    const hasImage = Boolean(theme.imagePath);
    const daysUntil = getDaysUntil(theme);
    const fontColor = theme.fontColor ?? 'rgba(255,255,255,0.95)';

    // Determine countdown line
    let countdownText: string | null = null;
    if (theme.showCountdown && daysUntil !== null) {
        if (daysUntil > 0) {
            countdownText = `${daysUntil} ${theme.countdownSuffix ?? ''}`;
        } else if (daysUntil === 0) {
            countdownText = theme.raceDayText ?? '🎉 Keppnisdagur!';
        }
        // daysUntil < 0 = after race day, show nothing
    }

    const bgPosition = theme.imagePosition === 'left'
        ? 'left center'
        : theme.imagePosition === 'right'
            ? 'right center'
            : 'center center';

    return (
        <div
            style={{
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                minHeight: 120,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                backgroundImage: hasImage
                    ? `url(${theme.imagePath})`
                    : (isDark ? theme.gradientDark : theme.gradient),
                backgroundSize: hasImage ? 'cover' : 'auto',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: bgPosition,
            }}
        >
            {/* Dark scrim */}
            {hasImage && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: isDark
                            ? 'linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.15) 100%)'
                            : 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.05) 100%)',
                    }}
                />
            )}

            {/* Text content */}
            <Box sx={{ position: 'relative', zIndex: 1, px: { xs: 2, sm: 3 }, py: 2 }}>
                {theme.headerLine && (
                    <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{
                            color: fontColor,
                            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                            lineHeight: 1.2,
                        }}
                    >
                        {theme.headerLine}
                    </Typography>
                )}
                {theme.tagline && (
                    <Typography
                        variant="body1"
                        fontWeight={600}
                        sx={{
                            color: fontColor,
                            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        }}
                    >
                        {theme.tagline}
                    </Typography>
                )}

                {countdownText && (
                    <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{
                            color: daysUntil === 0 ? '#FFD700' : 'rgba(255,255,255,0.95)',
                            textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                            lineHeight: 1.2,
                            mt: theme.tagline ? 0.5 : 0,
                        }}
                    >
                        {countdownText}
                    </Typography>
                )}

                {theme.externalUrl && (
                    <Link
                        href={theme.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mt: 0.5,
                            fontSize: '0.75rem',
                            color: hasImage ? 'rgba(255,255,255,0.75)' : 'primary.main',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                        }}
                    >
                        {new URL(theme.externalUrl).hostname}
                        <OpenInNewIcon sx={{ fontSize: 12 }} />
                    </Link>
                )}
            </Box>
        </div>
    );
}

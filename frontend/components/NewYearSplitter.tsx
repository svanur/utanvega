import { useRef, useEffect, Fragment, RefObject } from 'react';
import confetti from 'canvas-confetti';
import { Box, Stack, Typography, TableRow, TableCell, alpha, useTheme } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CelebrationIcon from '@mui/icons-material/Celebration';

// Module-level set so confetti fires once per year per page session, even if you scroll back up.
const firedYears = new Set<string>();

function fireConfetti(year: string) {
    if (firedYears.has(year)) return;
    firedYears.add(year);
    const burst = (x: number, delay: number) =>
        setTimeout(
            () =>
                confetti({
                    particleCount: 55,
                    spread: 60,
                    origin: { x, y: 0.55 },
                    startVelocity: 28,
                    ticks: 180,
                    zIndex: 9999,
                    colors: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'],
                    shapes: ['circle', 'square'],
                }),
            delay,
        );
    burst(0.15, 0);
    burst(0.85, 120);
    burst(0.5, 240);
}

function useFireConfettiOnVisible(ref: RefObject<Element | null>, year: string) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    fireConfetti(year);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, year]);
}

interface NewYearSplitterProps {
    year: string;
    label: string;
    showBanner?: boolean;
    bannerText?: string;
}

/** List-view version — renders Box elements. */
export function NewYearSplitter({ year, label, showBanner, bannerText }: NewYearSplitterProps) {
    const ref = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    useFireConfettiOnVisible(ref, year);

    return (
        <Fragment>
            <Box ref={ref} sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Stack direction="row" alignItems="center" gap={0.5}>
                    <AutoAwesomeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                    <Typography variant="caption" fontWeight={700} color="primary">
                        {label}
                    </Typography>
                    <AutoAwesomeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                </Stack>
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            </Box>
            {showBanner && bannerText && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.warning.main, 0.12),
                        mb: 1,
                    }}
                >
                    <CelebrationIcon sx={{ fontSize: 15, color: 'warning.dark' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: 'warning.dark' }}>
                        {bannerText}
                    </Typography>
                </Box>
            )}
        </Fragment>
    );
}

interface NewYearSplitterRowsProps {
    year: string;
    label: string;
    colSpan: number;
    showBanner?: boolean;
    bannerText?: string;
}

/** Table-view version — renders TableRow elements. */
export function NewYearSplitterRows({ year, label, colSpan, showBanner, bannerText }: NewYearSplitterRowsProps) {
    const ref = useRef<HTMLTableRowElement>(null);
    const theme = useTheme();
    useFireConfettiOnVisible(ref, year);

    return (
        <Fragment>
            <TableRow ref={ref}>
                <TableCell colSpan={colSpan} sx={{ py: 1, px: 2, border: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                        <Stack direction="row" alignItems="center" gap={0.5}>
                            <AutoAwesomeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                            <Typography variant="caption" fontWeight={700} color="primary">
                                {label}
                            </Typography>
                            <AutoAwesomeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                        </Stack>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                    </Stack>
                </TableCell>
            </TableRow>
            {showBanner && bannerText && (
                <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12) }}>
                    <TableCell colSpan={colSpan} sx={{ py: 0.5, px: 2, borderBottom: 0 }}>
                        <Stack direction="row" alignItems="center" gap={1}>
                            <CelebrationIcon sx={{ fontSize: 15, color: 'warning.dark' }} />
                            <Typography variant="caption" fontWeight={700} sx={{ color: 'warning.dark', letterSpacing: 0.3 }}>
                                {bannerText}
                            </Typography>
                        </Stack>
                    </TableCell>
                </TableRow>
            )}
        </Fragment>
    );
}

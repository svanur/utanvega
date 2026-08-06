import { useEffect, useRef, useState } from 'react';
import { Box, useTheme } from '@mui/material';

interface SwipeableCardProps {
    children: React.ReactNode;
    leftActions?: React.ReactNode;
    rightActions?: React.ReactNode;
    revealWidth?: number;
    rightRevealWidth?: number;
    onSwipeRight?: () => void;
    disabled?: boolean;
    peek?: boolean;
}

const LEFT_THRESHOLD = 60;
const RIGHT_THRESHOLD = 60;

export default function SwipeableCard({
    children,
    leftActions,
    rightActions,
    revealWidth = 130,
    rightRevealWidth = 80,
    onSwipeRight,
    disabled = false,
    peek = false,
}: SwipeableCardProps) {
    const theme = useTheme();
    const [offsetX, setOffsetX] = useState(0);
    const [animating, setAnimating] = useState(false);
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        if (!peek || !leftActions) return;
        setAnimating(true);
        setOffsetX(-40);
        const t = setTimeout(() => { setOffsetX(0); }, 500);
        return () => clearTimeout(t);
    }, [peek, leftActions]);

    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const isScrolling = useRef<boolean | null>(null);

    const snapTo = (x: number, isRevealed: boolean) => {
        setAnimating(true);
        setOffsetX(x);
        setRevealed(isRevealed);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        isScrolling.current = null;
        setAnimating(false);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (disabled || touchStartX.current === null || touchStartY.current === null) return;

        const deltaX = e.touches[0].clientX - touchStartX.current;
        const deltaY = e.touches[0].clientY - touchStartY.current;

        if (isScrolling.current === null) {
            if (Math.abs(deltaY) > Math.abs(deltaX) + 5) {
                isScrolling.current = true;
            } else if (Math.abs(deltaX) > 10) {
                isScrolling.current = false;
            }
        }

        if (isScrolling.current) return;

        if (revealed) {
            const newOffset = Math.min(0, -revealWidth + Math.max(0, deltaX));
            setOffsetX(newOffset);
        } else if (deltaX < 0 && leftActions) {
            setOffsetX(Math.max(-revealWidth, deltaX));
        } else if (deltaX > 0 && (rightActions || onSwipeRight)) {
            setOffsetX(Math.min(rightRevealWidth, deltaX));
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (disabled || touchStartX.current === null) return;

        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const wasScrolling = isScrolling.current;

        touchStartX.current = null;
        touchStartY.current = null;
        isScrolling.current = null;

        if (wasScrolling) return;

        if (revealed) {
            if (deltaX > LEFT_THRESHOLD) {
                snapTo(0, false);
            } else {
                snapTo(-revealWidth, true);
            }
            return;
        }

        if (deltaX < -LEFT_THRESHOLD && leftActions) {
            snapTo(-revealWidth, true);
        } else if (deltaX > RIGHT_THRESHOLD && (rightActions || onSwipeRight)) {
            snapTo(0, false);
            onSwipeRight?.();
        } else {
            snapTo(0, false);
        }
    };

    const closeReveal = () => {
        if (revealed) snapTo(0, false);
    };

    const showLeftPanel = offsetX < 0 || revealed;
    const showRightPanel = offsetX > 0;

    return (
        <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: `${theme.shape.borderRadius}px` }}>
            {/* Left-swipe action panel */}
            {leftActions && showLeftPanel && (
                <Box sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: revealWidth,
                    display: 'flex',
                    alignItems: 'stretch',
                }}>
                    {leftActions}
                </Box>
            )}

            {/* Right-swipe action panel */}
            {rightActions && showRightPanel && (
                <Box sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: rightRevealWidth,
                    display: 'flex',
                    alignItems: 'stretch',
                }}>
                    {rightActions}
                </Box>
            )}

            {/* Card — slides with touch */}
            <Box
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={revealed ? closeReveal : undefined}
                sx={{
                    transform: `translateX(${offsetX}px)`,
                    transition: animating ? 'transform 0.25s ease' : 'none',
                    position: 'relative',
                    zIndex: 1,
                    cursor: revealed ? 'pointer' : undefined,
                }}
            >
                {children}
            </Box>
        </Box>
    );
}

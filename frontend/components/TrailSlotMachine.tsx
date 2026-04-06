import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Backdrop } from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';

interface TrailSlotMachineProps {
    open: boolean;
    trailNames: string[];
    winner: string;
    onComplete: () => void;
}

export default function TrailSlotMachine({ open, trailNames, winner, onComplete }: TrailSlotMachineProps) {
    const [displayName, setDisplayName] = useState('');
    const [settled, setSettled] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const onCompleteRef = useRef(onComplete);
    const winnerRef = useRef(winner);

    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
    useEffect(() => { winnerRef.current = winner; }, [winner]);

    useEffect(() => {
        if (!open) return;

        const names = trailNames.length > 0 ? trailNames : [winnerRef.current || '...'];
        setSettled(false);
        setDisplayName('');
        let speed = 60;
        let elapsed = 0;
        const totalDuration = 1800;

        const tick = () => {
            const pick = names[Math.floor(Math.random() * names.length)];
            setDisplayName(pick);
            elapsed += speed;

            if (elapsed >= totalDuration) {
                setDisplayName(winnerRef.current);
                setSettled(true);
                timeoutRef.current = setTimeout(() => onCompleteRef.current(), 900);
                return;
            }

            speed = Math.min(300, speed + 15);
            intervalRef.current = setTimeout(tick, speed);
        };

        intervalRef.current = setTimeout(tick, speed);

        return () => {
            if (intervalRef.current) clearTimeout(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    return (
        <Backdrop
            open={open}
            sx={{
                zIndex: (theme) => theme.zIndex.modal + 1,
                bgcolor: 'rgba(0, 0, 0, 0.85)',
                flexDirection: 'column',
                gap: 3,
            }}
        >
            <CasinoIcon
                sx={{
                    fontSize: 56,
                    color: '#fff',
                    animation: settled ? 'none' : 'spin 0.5s linear infinite',
                    '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                    },
                }}
            />

            <Box
                sx={{
                    border: '2px solid',
                    borderColor: settled ? 'success.main' : 'grey.600',
                    borderRadius: 3,
                    px: 4,
                    py: 2,
                    minWidth: { xs: 260, sm: 350 },
                    textAlign: 'center',
                    bgcolor: settled ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                    transition: 'all 0.3s ease',
                }}
            >
                <Typography
                    variant="h5"
                    sx={{
                        color: '#fff',
                        fontWeight: settled ? 'bold' : 'normal',
                        fontSize: { xs: '1.2rem', sm: '1.5rem' },
                        transition: 'font-weight 0.2s',
                        minHeight: '2em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {displayName || '...'}
                </Typography>
            </Box>

            {settled && (
                <Typography
                    variant="body2"
                    sx={{
                        color: 'grey.400',
                        animation: 'fadeIn 0.4s ease-in',
                        '@keyframes fadeIn': {
                            '0%': { opacity: 0 },
                            '100%': { opacity: 1 },
                        },
                    }}
                >
                    🏃 Let&apos;s go!
                </Typography>
            )}
        </Backdrop>
    );
}

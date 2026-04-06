import { useState, useEffect, useRef } from 'react';

interface TrailSlotMachineProps {
    open: boolean;
    trailNames: string[];
    winner: string;
    onComplete: () => void;
}

export default function TrailSlotMachine({ open, trailNames, winner, onComplete }: TrailSlotMachineProps) {
    const [displayName, setDisplayName] = useState('');
    const [settled, setSettled] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setTimeout>>();
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
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
        }}>
            {/* Spinning dice emoji */}
            <div style={{
                fontSize: '48px',
                animation: settled ? 'none' : 'slotSpin 0.5s linear infinite',
            }}>
                🎲
            </div>
            <style>{`@keyframes slotSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

            {/* Trail name display */}
            <div style={{
                border: `2px solid ${settled ? '#4caf50' : '#666'}`,
                borderRadius: '12px',
                padding: '16px 32px',
                minWidth: '260px',
                maxWidth: '90vw',
                textAlign: 'center',
                backgroundColor: settled ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                transition: 'all 0.3s ease',
            }}>
                <div style={{
                    color: '#ffffff',
                    fontWeight: settled ? 'bold' : 'normal',
                    fontSize: settled ? '1.4rem' : '1.2rem',
                    minHeight: '2em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                }}>
                    {displayName || '...'}
                </div>
            </div>

            {/* Let's go! */}
            {settled && (
                <div style={{
                    color: '#aaa',
                    fontSize: '0.9rem',
                    animation: 'slotFadeIn 0.4s ease-in',
                }}>
                    🏃 Let&apos;s go!
                </div>
            )}
            <style>{`@keyframes slotFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
        setDisplayName(names[0]);
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

    const overlay = (
        <>
            <style>{`
                .slot-overlay { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.9); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px; }
                .slot-dice { font-size:48px; }
                .slot-dice.spinning { animation: slotSpin 0.5s linear infinite; }
                .slot-box { border:2px solid #666; border-radius:12px; padding:16px 32px; min-width:260px; max-width:90vw; text-align:center; background:rgba(255,255,255,0.08); transition:all 0.3s ease; }
                .slot-box.settled { border-color:#4caf50; background:rgba(76,175,80,0.15); }
                .slot-name { color:#fff; font-size:1.3rem; min-height:2em; display:flex; align-items:center; justify-content:center; font-family:inherit; transition:all 0.2s; }
                .slot-name.settled { font-weight:bold; font-size:1.5rem; }
                .slot-go { color:#aaa; font-size:0.9rem; opacity:0; animation: slotFadeIn 0.4s ease-in forwards; }
                @keyframes slotSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes slotFadeIn { from{opacity:0} to{opacity:1} }
            `}</style>
            <div className="slot-overlay" onClick={(e) => e.stopPropagation()}>
                <div className={`slot-dice ${settled ? '' : 'spinning'}`}>🎲</div>
                <div className={`slot-box ${settled ? 'settled' : ''}`}>
                    <div className={`slot-name ${settled ? 'settled' : ''}`}>
                        {displayName || '...'}
                    </div>
                </div>
                {settled && <div className="slot-go">🏃 Let&apos;s go!</div>}
            </div>
        </>
    );

    return createPortal(overlay, document.body);
}

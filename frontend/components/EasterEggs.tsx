import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EasterEgg } from '../hooks/useEasterEggs';

interface Props {
    activeEgg: EasterEgg;
    onComplete: () => void;
}

// ==================== KONAMI RUNNER + CONFETTI ====================

function KonamiRunner({ onComplete }: { onComplete: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onComplete, 4500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    const [confetti] = useState(() => Array.from({ length: 60 }, (_, i) => {
        const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4', '#a855f7'];
        return {
            id: i,
            color: colors[i % colors.length],
            left: Math.random() * 100,
            delay: Math.random() * 2.5,
            duration: 2 + Math.random() * 2,
            size: 6 + Math.random() * 8,
            rotation: Math.random() * 360,
        };
    }));

    return (
        <div className="ee-konami-overlay">
            <style>{`
                .ee-konami-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    pointer-events: none;
                    overflow: hidden;
                }
                .ee-runner {
                    position: absolute;
                    bottom: 30%;
                    font-size: 80px;
                    animation: ee-run 3.5s ease-in-out forwards;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
                }
                @keyframes ee-run {
                    0% { left: -120px; }
                    100% { left: calc(100vw + 120px); }
                }
                .ee-confetti {
                    position: absolute;
                    top: -20px;
                    border-radius: 2px;
                    animation: ee-fall linear forwards;
                }
                @keyframes ee-fall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    80% { opacity: 1; }
                    100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
                }
            `}</style>
            <div className="ee-runner">🏃</div>
            {confetti.map(c => (
                <div
                    key={c.id}
                    className="ee-confetti"
                    style={{
                        left: `${c.left}%`,
                        width: c.size,
                        height: c.size,
                        backgroundColor: c.color,
                        animationDelay: `${c.delay}s`,
                        animationDuration: `${c.duration}s`,
                        transform: `rotate(${c.rotation}deg)`,
                    }}
                />
            ))}
        </div>
    );
}

// ==================== ULTRA NIGHT MODE + HEADLAMP ====================

function UltraNight({ onComplete }: { onComplete: () => void }) {
    const [mouse, setMouse] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [phase, setPhase] = useState<'in' | 'active' | 'out'>('in');

    useEffect(() => {
        const handleMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
        const handleTouch = (e: TouchEvent) => {
            const t = e.touches[0];
            if (t) setMouse({ x: t.clientX, y: t.clientY });
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleTouch);

        const activeTimer = setTimeout(() => setPhase('active'), 300);
        const outTimer = setTimeout(() => setPhase('out'), 5500);
        const doneTimer = setTimeout(onComplete, 6500);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleTouch);
            clearTimeout(activeTimer);
            clearTimeout(outTimer);
            clearTimeout(doneTimer);
        };
    }, [onComplete]);

    const opacity = phase === 'in' ? 0 : phase === 'out' ? 0 : 1;

    return (
        <div
            className="ee-ultra-overlay"
            style={{
                opacity,
                background: `radial-gradient(circle 130px at ${mouse.x}px ${mouse.y}px, 
                    rgba(255,255,200,0.15) 0%, 
                    rgba(255,255,150,0.04) 50%, 
                    rgba(0,0,0,0.96) 100%)`,
            }}
        >
            <style>{`
                .ee-ultra-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    pointer-events: none;
                    transition: opacity 0.8s ease;
                }
                .ee-ultra-text {
                    position: absolute;
                    top: 8%;
                    width: 100%;
                    text-align: center;
                    color: rgba(255,255,200,0.5);
                    font-size: 13px;
                    font-family: monospace;
                    letter-spacing: 6px;
                    text-transform: uppercase;
                    animation: ee-ultra-pulse 1.5s ease-in-out infinite;
                }
                @keyframes ee-ultra-pulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.7; }
                }
            `}</style>
            <div className="ee-ultra-text">🔦 ultra mode 🔦</div>
        </div>
    );
}

// ==================== MATRIX RAIN ====================

const MATRIX_QUOTES = [
    "There is no spoon.",
    "Follow the white rabbit.",
    "Wake up, Neo...",
    "I know kung fu.",
    "The Matrix has you...",
    "Free your mind.",
    "What is real?",
    "You take the red pill... you stay in Wonderland.",
    "He is the One.",
    "Dodge this.",
];

function MatrixRain({ onComplete }: { onComplete: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [quote] = useState(() => MATRIX_QUOTES[Math.floor(Math.random() * MATRIX_QUOTES.length)]);
    const [showQuote, setShowQuote] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&';
        const fontSize = 14;
        const columns = Math.floor(canvas.width / fontSize);
        const drops: number[] = Array.from({ length: columns }, () => Math.random() * -40);

        let frameId: number;
        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                if (drops[i] < 0) {
                    drops[i] += 0.5;
                    continue;
                }

                const char = chars[Math.floor(Math.random() * chars.length)];
                // Leading character is bright white-green, rest fades
                const isHead = Math.random() > 0.97;
                ctx.fillStyle = isHead ? '#fff' : `rgba(0, ${150 + Math.random() * 105}, 0, ${0.8 + Math.random() * 0.2})`;
                ctx.fillText(char, i * fontSize, drops[i] * fontSize);

                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }

            frameId = requestAnimationFrame(draw);
        };

        frameId = requestAnimationFrame(draw);

        const quoteTimer = setTimeout(() => setShowQuote(true), 1500);
        const doneTimer = setTimeout(onComplete, 7000);

        return () => {
            cancelAnimationFrame(frameId);
            clearTimeout(quoteTimer);
            clearTimeout(doneTimer);
        };
    }, [onComplete]);

    return (
        <>
            <style>{`
                .ee-matrix-canvas {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: #000;
                    cursor: pointer;
                }
                .ee-matrix-quote {
                    position: fixed;
                    z-index: 100000;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #0f0;
                    font-family: 'Courier New', monospace;
                    font-size: clamp(18px, 3vw, 36px);
                    text-align: center;
                    text-shadow: 0 0 10px #0f0, 0 0 20px #0f0, 0 0 40px #0a0;
                    max-width: 80vw;
                    animation: ee-matrix-fade 1.2s ease-in forwards;
                    pointer-events: none;
                }
                @keyframes ee-matrix-fade {
                    0% { opacity: 0; letter-spacing: 20px; }
                    100% { opacity: 1; letter-spacing: 3px; }
                }
            `}</style>
            <canvas ref={canvasRef} className="ee-matrix-canvas" onClick={onComplete} />
            {showQuote && <div className="ee-matrix-quote">{quote}</div>}
        </>
    );
}

// ==================== ORIGINALS (Hin upprunalegu) ====================

function Originals({ onComplete }: { onComplete: () => void }) {
    const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('show'), 400);
        const t2 = setTimeout(() => setPhase('exit'), 4500);
        const t3 = setTimeout(onComplete, 5500);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [onComplete]);

    const runes = 'ᚠᚢᚦᚬᚱᚴᚼᚾᛁᛅᛋᛏᛒᛘᛚᛦ';
    const [particles] = useState(() => Array.from({ length: 30 }, (_, i) => ({
        id: i,
        char: runes[i % runes.length],
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 4,
        size: 16 + Math.random() * 24,
    })));

    return (
        <div className={`ee-originals-overlay ee-originals-${phase}`}>
            <style>{`
                .ee-originals-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    transition: opacity 0.8s ease;
                    pointer-events: none;
                }
                .ee-originals-enter {
                    background: rgba(0, 0, 0, 0.9);
                    opacity: 0;
                }
                .ee-originals-show {
                    background: radial-gradient(ellipse at center, rgba(139, 90, 20, 0.4) 0%, rgba(0, 0, 0, 0.95) 70%);
                    opacity: 1;
                }
                .ee-originals-exit {
                    background: rgba(0, 0, 0, 0.9);
                    opacity: 0;
                }
                .ee-originals-title {
                    color: #d4a847;
                    font-family: 'Georgia', 'Times New Roman', serif;
                    font-size: clamp(28px, 5vw, 56px);
                    font-style: italic;
                    text-align: center;
                    text-shadow: 0 0 20px rgba(212, 168, 71, 0.6), 0 0 40px rgba(212, 168, 71, 0.3);
                    animation: ee-originals-reveal 2s ease-out forwards;
                    letter-spacing: 4px;
                }
                .ee-originals-sub {
                    color: rgba(212, 168, 71, 0.5);
                    font-family: 'Georgia', serif;
                    font-size: clamp(12px, 2vw, 18px);
                    margin-top: 12px;
                    letter-spacing: 8px;
                    text-transform: uppercase;
                    animation: ee-originals-sub-reveal 2.5s ease-out forwards;
                }
                @keyframes ee-originals-reveal {
                    0% { opacity: 0; transform: scale(0.7); filter: blur(10px); }
                    60% { opacity: 1; transform: scale(1.05); filter: blur(0); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes ee-originals-sub-reveal {
                    0%, 40% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .ee-rune {
                    position: absolute;
                    bottom: -40px;
                    color: rgba(212, 168, 71, 0.25);
                    animation: ee-rune-float linear forwards;
                    pointer-events: none;
                }
                @keyframes ee-rune-float {
                    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 0.3; }
                    50% { opacity: 0.5; }
                    100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
                }
            `}</style>
            {particles.map(p => (
                <div
                    key={p.id}
                    className="ee-rune"
                    style={{
                        left: `${p.left}%`,
                        fontSize: p.size,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                    }}
                >
                    {p.char}
                </div>
            ))}
            <div className="ee-originals-title">✦ Hin upprunalegu ✦</div>
            <div className="ee-originals-sub">the originals</div>
        </div>
    );
}

// ==================== MAIN COMPONENT ====================

export function EasterEggs({ activeEgg, onComplete }: Props) {
    if (!activeEgg) return null;

    return createPortal(
        <>
            {activeEgg === 'konami' && <KonamiRunner onComplete={onComplete} />}
            {activeEgg === 'ultra' && <UltraNight onComplete={onComplete} />}
            {activeEgg === 'matrix' && <MatrixRain onComplete={onComplete} />}
            {activeEgg === 'originals' && <Originals onComplete={onComplete} />}
        </>,
        document.body
    );
}

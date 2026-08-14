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

    const workouts = [
        '5 × 1 km at threshold 🔥',
        'Today is TEMPO day!',
        '10 km at marathon pace 🏅',
        'Easy 8 km recovery jog 🧘',
        '400m repeats × 10 — go!',
        'Fartlek: 1 min fast, 2 min easy',
        'Long run: 25 km, stay chill 😎',
        'Hill sprints × 8 — find a hill!',
        '3 × 2 km at half-marathon pace',
        'Strides after warm-up today',
        '6 × 800 m with 90s recovery',
        'Progression run: start easy, finish fast',
        '20 min tempo, 10 min easy, repeat',
        'Track Tuesday: 12 × 400 m 🏟️',
        'Rest day... just kidding, GO RUN!',
    ];

    const [workout] = useState(() => workouts[Math.floor(Math.random() * workouts.length)]);

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
                    transform: scaleX(-1);
                    animation: ee-run 3.5s ease-in-out forwards;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
                }
                @keyframes ee-run {
                    0% { left: -120px; }
                    100% { left: calc(100vw + 120px); }
                }
                .ee-workout {
                    position: absolute;
                    bottom: 15%;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: clamp(16px, 3vw, 28px);
                    font-weight: 700;
                    color: #fff;
                    text-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 0 20px rgba(255,107,107,0.4);
                    white-space: nowrap;
                    animation: ee-workout-pop 0.5s ease-out 0.8s both;
                    font-family: system-ui, -apple-system, sans-serif;
                }
                @keyframes ee-workout-pop {
                    0% { opacity: 0; transform: translateX(-50%) scale(0.5); }
                    70% { transform: translateX(-50%) scale(1.1); }
                    100% { opacity: 1; transform: translateX(-50%) scale(1); }
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
            <div className="ee-workout">{workout}</div>
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

// ==================== ÚT AÐ HLAUPA ====================

const PODCAST_IMG = 'https://i.scdn.co/image/ab6765630000ba8a877d2cca1e23c998f2b8b6a3';
const UTAD_QUOTES = ['Ekki trufla mig á threshold! 🔥', 'Ekki festast á hjólinu! 🚴'];

function UtadHlaupa({ onComplete }: { onComplete: () => void }) {
    const [quote] = useState(() => UTAD_QUOTES[Math.floor(Math.random() * UTAD_QUOTES.length)]);
    const [showQuote, setShowQuote] = useState(false);

    useEffect(() => {
        document.body.classList.add('ee-utadahlaupa-active');

        const audio = new Audio('/audio/utadahlaupa.mp3');
        audio.volume = 0.6;
        audio.play().catch(() => { /* autoplay blocked — silently skip */ });

        const t1 = setTimeout(() => setShowQuote(true), 6000);
        const t2 = setTimeout(onComplete, 11000);
        return () => {
            audio.pause();
            audio.currentTime = 0;
            document.body.classList.remove('ee-utadahlaupa-active');
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [onComplete]);

    return (
        <div className="ee-pod-overlay">
            <style>{`
                .ee-pod-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    pointer-events: none;
                    overflow: hidden;
                }
                /* Podcast card */
                .ee-pod-card {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0,0,0,0.82);
                    border-radius: 12px;
                    padding: 8px 14px 8px 8px;
                    backdrop-filter: blur(6px);
                    animation: ee-pod-card-in 0.5s ease-out forwards;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    z-index: 1;
                }
                @keyframes ee-pod-card-in {
                    from { opacity: 0; transform: translateX(40px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .ee-pod-card img {
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    object-fit: cover;
                }
                .ee-pod-card-text {
                    display: flex;
                    flex-direction: column;
                }
                .ee-pod-card-label {
                    font-size: 10px;
                    color: rgba(255,255,255,0.5);
                    font-family: system-ui, sans-serif;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                }
                .ee-pod-card-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: #fff;
                    font-family: system-ui, sans-serif;
                }
                .ee-pod-card-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #1DB954;
                    animation: ee-pod-dot-pulse 1.2s ease-in-out infinite;
                    flex-shrink: 0;
                }
                @keyframes ee-pod-dot-pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.7; }
                }
                /* Hide sponsor and promo strips while egg is active */
                body.ee-utadahlaupa-active [data-sponsor-strip],
                body.ee-utadahlaupa-active [data-promo-strip] {
                    visibility: hidden;
                }
                /* Yellow top splash — Út að hlaupa brand colors */
                .ee-pod-top {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 38%;
                    background: linear-gradient(to bottom, rgba(255,210,0,0.88) 0%, rgba(255,210,0,0.5) 60%, transparent 100%);
                }
                /* Dark stage behind runners — covers bottom ads */
                .ee-pod-stage {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 38%;
                    background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 30%, rgba(0,0,0,0.85) 100%);
                }
                /* Runners track */
                .ee-pod-track {
                    position: absolute;
                    bottom: 42%;
                    left: 0;
                    width: 100%;
                }
                /* Marteinn — slow and steady */
                .ee-marteinn {
                    position: absolute;
                    bottom: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    animation: ee-marteinn-run 11s linear forwards;
                }
                @keyframes ee-marteinn-run {
                    0%   { left: -120px; }
                    100% { left: 80vw; }
                }
                /* Þorsteinn — fast, laps twice. Total 11s.
                   Lap 1: enters at 1.5s (13.6%), done at 4s (36.4%) — 2.5s crossing
                   Lap 2: enters at 5.5s (50%), done at 8s (72.7%) — 2.5s crossing */
                .ee-thorsteinn {
                    position: absolute;
                    bottom: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    animation: ee-thorsteinn-run 11s linear forwards;
                }
                @keyframes ee-thorsteinn-run {
                    /* Lap 1: enters at 1.5s (13%), done at 5s (45%) — 3.5s crossing */
                    0%     { left: -120px; opacity: 0; }
                    13%    { left: -120px; opacity: 1; }
                    45%    { left: calc(100vw + 120px); opacity: 1; }
                    /* Instant reset */
                    45.1%  { left: -120px; opacity: 0; }
                    53%    { left: -120px; opacity: 0; }
                    /* Lap 2: enters at 6s (54%), done at 9.5s (86%) — 3.5s crossing */
                    54%    { left: -120px; opacity: 1; }
                    86%    { left: calc(100vw + 120px); opacity: 1; }
                    100%   { left: calc(100vw + 120px); opacity: 0; }
                }
                .ee-runner-name {
                    font-size: 12px;
                    font-weight: 700;
                    color: #fff;
                    font-family: system-ui, sans-serif;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
                    white-space: nowrap;
                    margin-bottom: 2px;
                    background: rgba(0,0,0,0.45);
                    border-radius: 4px;
                    padding: 1px 5px;
                }
                .ee-runner-emoji {
                    font-size: 52px;
                    line-height: 1;
                    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
                    transform: scaleX(-1);
                }
                .ee-thorsteinn .ee-runner-emoji {
                    font-size: 58px;
                }
                /* Speed blur on Þorsteinn */
                .ee-thorsteinn .ee-runner-emoji {
                    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)) drop-shadow(-6px 0 8px rgba(255,160,0,0.5));
                }
                /* Quote */
                .ee-pod-quote {
                    position: absolute;
                    bottom: 14%;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: clamp(15px, 2.5vw, 26px);
                    font-weight: 700;
                    font-style: italic;
                    color: #fff;
                    font-family: system-ui, sans-serif;
                    text-shadow: 0 2px 8px rgba(0,0,0,0.7);
                    white-space: nowrap;
                    animation: ee-pod-quote-in 0.6s ease-out forwards;
                    text-align: center;
                }
                @keyframes ee-pod-quote-in {
                    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                /* Dust puffs under Marteinn */
                .ee-dust {
                    position: absolute;
                    bottom: -8px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 18px;
                    animation: ee-dust-puff 0.6s ease-out infinite;
                }
                @keyframes ee-dust-puff {
                    0%   { opacity: 0.7; transform: translateX(-50%) scale(0.5); }
                    100% { opacity: 0; transform: translateX(-50%) scale(1.5) translateY(-8px); }
                }
            `}</style>

            {/* Podcast "now playing" card */}
            <div className="ee-pod-card">
                <img src={PODCAST_IMG} alt="Út að hlaupa podcast" />
                <div className="ee-pod-card-text">
                    <span className="ee-pod-card-label">🎙 Í gangi</span>
                    <span className="ee-pod-card-title">Út að hlaupa</span>
                </div>
                <div className="ee-pod-card-dot" />
            </div>

            {/* Yellow top splash */}
            <div className="ee-pod-top" />

            {/* Dark stage to cover bottom ads */}
            <div className="ee-pod-stage" />

            {/* Running track */}
            <div className="ee-pod-track">
                <div className="ee-marteinn">
                    <div className="ee-runner-name">Marteinn</div>
                    <div className="ee-runner-emoji">🏃</div>
                    <div className="ee-dust">💨</div>
                </div>
                <div className="ee-thorsteinn">
                    <div className="ee-runner-name">Þorsteinn ⚡</div>
                    <div className="ee-runner-emoji">🏃</div>
                </div>
            </div>

            {/* Random quote */}
            {showQuote && <div className="ee-pod-quote">"{quote}"</div>}
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
            {activeEgg === 'utadahlaupa' && <UtadHlaupa onComplete={onComplete} />}
        </>,
        document.body
    );
}

import { useMemo } from 'react';
import { AppBar, Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import type { HeaderWeather } from '../hooks/useHeaderWeather';

// ─── Time-of-Day Gradients ───────────────────────────────────────

interface TimeSlot {
    hours: [number, number];
    gradient: string;
    gradientDark: string;
}

const TIME_SLOTS: TimeSlot[] = [
    { hours: [5, 8],   gradient: 'linear-gradient(90deg, #FF6B35 0%, #F7931E 50%, #FDB813 100%)', gradientDark: 'linear-gradient(90deg, #bf4a1f 0%, #b36a10 50%, #a8820d 100%)' },
    { hours: [8, 12],  gradient: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)', gradientDark: 'linear-gradient(90deg, #0d47a1 0%, #1565c0 100%)' },
    { hours: [12, 17], gradient: 'linear-gradient(90deg, #1565c0 0%, #1976d2 50%, #2196f3 100%)', gradientDark: 'linear-gradient(90deg, #0d3b7a 0%, #0d47a1 50%, #1565c0 100%)' },
    { hours: [17, 20], gradient: 'linear-gradient(90deg, #FF6B35 0%, #e65100 40%, #AD1457 100%)', gradientDark: 'linear-gradient(90deg, #bf4a1f 0%, #a33b00 40%, #7b0d3c 100%)' },
    { hours: [20, 23], gradient: 'linear-gradient(90deg, #283593 0%, #1a237e 100%)', gradientDark: 'linear-gradient(90deg, #1a2260 0%, #0d1242 100%)' },
    { hours: [23, 5],  gradient: 'linear-gradient(90deg, #0d1b2a 0%, #1b2838 100%)', gradientDark: 'linear-gradient(90deg, #060d15 0%, #0d1520 100%)' },
];

function getTimeGradient(hour: number, isDark: boolean): string {
    for (const slot of TIME_SLOTS) {
        const [start, end] = slot.hours;
        if (start < end) {
            if (hour >= start && hour < end) return isDark ? slot.gradientDark : slot.gradient;
        } else {
            // Wraps midnight (e.g. 23-5)
            if (hour >= start || hour < end) return isDark ? slot.gradientDark : slot.gradient;
        }
    }
    return isDark ? 'linear-gradient(90deg, #0d47a1 0%, #1565c0 100%)' : 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)';
}

// ─── Weather Particles (CSS keyframes injected once) ──────────────

let stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes uv-snow {
            0% { transform: translateY(-10px) translateX(0); opacity: 1; }
            100% { transform: translateY(65px) translateX(20px); opacity: 0.3; }
        }
        @keyframes uv-rain {
            0% { transform: translateY(-10px) translateX(0); opacity: 0.8; }
            100% { transform: translateY(70px) translateX(-15px); opacity: 0; }
        }
        @keyframes uv-aurora {
            0% { background-position: 0% 50%; opacity: 0.15; }
            25% { opacity: 0.25; }
            50% { background-position: 100% 50%; opacity: 0.15; }
            75% { opacity: 0.3; }
            100% { background-position: 0% 50%; opacity: 0.15; }
        }
        @keyframes uv-glow {
            0% { opacity: 0.1; }
            50% { opacity: 0.25; }
            100% { opacity: 0.1; }
        }
        @keyframes uv-fog-drift {
            0% { transform: translateX(-30px); opacity: 0.3; }
            50% { opacity: 0.5; }
            100% { transform: translateX(30px); opacity: 0.3; }
        }
    `;
    document.head.appendChild(style);
}

// ─── Weather → Effect Mapping ─────────────────────────────────────

type WeatherEffect = 'snow' | 'rain' | 'clear' | 'fog' | 'storm' | 'cloudy' | 'none';

function getWeatherEffect(code: number): WeatherEffect {
    if (code >= 95) return 'storm';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code >= 61 && code <= 65) return 'rain';
    if (code >= 51 && code <= 55) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 1 && code <= 3) return 'cloudy';
    if (code === 0) return 'clear';
    return 'none';
}

// ─── Aurora Borealis Check ────────────────────────────────────────

function isAuroraSeason(now: Date): boolean {
    const month = now.getMonth(); // 0-indexed
    const hour = now.getHours();
    // Oct (9) through Mar (2), between 9 PM and 3 AM
    const winterMonth = month >= 9 || month <= 2;
    const nightHour = hour >= 21 || hour < 3;
    return winterMonth && nightHour;
}

// ─── Midnight Sun Check ──────────────────────────────────────────

function isMidnightSun(now: Date): boolean {
    const month = now.getMonth();
    const hour = now.getHours();
    // June (5) and July (6), late evening/night
    return (month === 5 || month === 6) && (hour >= 22 || hour < 2);
}

// ─── Particle Generation ─────────────────────────────────────────

interface Particle {
    key: number;
    left: string;
    animDelay: string;
    animDuration: string;
    size: number;
    opacity: number;
}

function generateParticles(count: number): Particle[] {
    return Array.from({ length: count }, (_, i) => ({
        key: i,
        left: `${Math.random() * 100}%`,
        animDelay: `${Math.random() * 3}s`,
        animDuration: `${1.5 + Math.random() * 2}s`,
        size: 1 + Math.random() * 2,
        opacity: 0.4 + Math.random() * 0.6,
    }));
}

// ─── Component ───────────────────────────────────────────────────

interface DynamicHeaderProps {
    weather: HeaderWeather | null;
    isDark: boolean;
    children: React.ReactNode;
}

export default function DynamicHeader({ weather, isDark, children }: DynamicHeaderProps) {
    const now = useMemo(() => new Date(), []);
    const hour = now.getHours();
    const gradient = getTimeGradient(hour, isDark);
    const effect = weather ? getWeatherEffect(weather.weatherCode) : 'none';
    const showAurora = isAuroraSeason(now);
    const showMidnightSun = isMidnightSun(now);

    const particles = useMemo(() => {
        if (effect === 'snow') return generateParticles(18);
        if (effect === 'rain' || effect === 'storm') return generateParticles(15);
        return [];
    }, [effect]);

    injectStyles();

    const overlayStyle: SxProps<Theme> = {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
    };

    return (
        <AppBar
            position="sticky"
            elevation={0}
            sx={{
                background: gradient,
                position: 'relative',
                transition: 'background 2s ease',
            }}
        >
            {/* Weather particle overlay */}
            {(effect === 'snow' || effect === 'rain' || effect === 'storm') && (
                <Box sx={overlayStyle}>
                    {particles.map(p => (
                        <Box
                            key={p.key}
                            sx={{
                                position: 'absolute',
                                left: p.left,
                                top: '-5px',
                                width: effect === 'rain' ? '1px' : `${p.size}px`,
                                height: effect === 'rain' ? `${p.size * 4}px` : `${p.size}px`,
                                borderRadius: effect === 'snow' ? '50%' : '0',
                                bgcolor: effect === 'snow' ? 'rgba(255,255,255,0.8)' : 'rgba(180,210,255,0.5)',
                                opacity: p.opacity,
                                animation: `${effect === 'snow' ? 'uv-snow' : 'uv-rain'} ${p.animDuration} ${p.animDelay} infinite linear`,
                                willChange: 'transform',
                            }}
                        />
                    ))}
                    {/* Storm: occasional flash */}
                    {effect === 'storm' && (
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                animation: 'uv-glow 4s 2s infinite',
                                bgcolor: 'rgba(255,255,255,0.05)',
                            }}
                        />
                    )}
                </Box>
            )}

            {/* Clear sky: golden glow */}
            {effect === 'clear' && (hour >= 8 && hour < 20) && (
                <Box
                    sx={{
                        ...overlayStyle,
                        background: 'radial-gradient(ellipse at 85% 30%, rgba(255,215,0,0.15) 0%, transparent 60%)',
                        animation: 'uv-glow 6s infinite',
                    }}
                />
            )}

            {/* Fog: drifting haze */}
            {effect === 'fog' && (
                <Box
                    sx={{
                        ...overlayStyle,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(200,200,210,0.2) 30%, rgba(200,200,210,0.3) 50%, rgba(200,200,210,0.2) 70%, transparent 100%)',
                        animation: 'uv-fog-drift 8s infinite ease-in-out',
                    }}
                />
            )}

            {/* Aurora Borealis: winter nights */}
            {showAurora && (
                <Box
                    sx={{
                        ...overlayStyle,
                        background: 'linear-gradient(90deg, transparent 10%, rgba(0,255,100,0.12) 25%, rgba(50,200,150,0.08) 40%, rgba(100,50,200,0.12) 60%, rgba(0,200,100,0.08) 75%, transparent 90%)',
                        backgroundSize: '200% 100%',
                        animation: 'uv-aurora 12s infinite ease-in-out',
                    }}
                />
            )}

            {/* Midnight sun: warm golden glow */}
            {showMidnightSun && (
                <Box
                    sx={{
                        ...overlayStyle,
                        background: 'radial-gradient(ellipse at 50% 100%, rgba(255,180,50,0.2) 0%, transparent 70%)',
                        animation: 'uv-glow 8s infinite',
                    }}
                />
            )}

            {/* Actual toolbar content — above overlays */}
            <Box sx={{ position: 'relative', zIndex: 1 }}>
                {children}
            </Box>
        </AppBar>
    );
}

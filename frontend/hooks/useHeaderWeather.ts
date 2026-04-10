import { useState, useEffect } from 'react';

export interface HeaderWeather {
    weatherCode: number;
    temperature: number;
    windSpeed: number;
}

const REYKJAVIK = { lat: 64.1466, lng: -21.9426 };
const CACHE_KEY = 'utanvega-header-weather';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CachedWeather {
    data: HeaderWeather;
    timestamp: number;
    lat: number;
    lng: number;
}

function getUserLocation(): { lat: number; lng: number } | null {
    try {
        const raw = sessionStorage.getItem('utanvega-user-loc');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function getCached(lat: number, lng: number): HeaderWeather | null {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached: CachedWeather = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_TTL) return null;
        const dist = Math.abs(cached.lat - lat) + Math.abs(cached.lng - lng);
        if (dist > 0.1) return null;
        return cached.data;
    } catch {
        return null;
    }
}

function setCache(data: HeaderWeather, lat: number, lng: number) {
    try {
        const entry: CachedWeather = { data, timestamp: Date.now(), lat, lng };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch { /* ignore */ }
}

export function useHeaderWeather() {
    const [weather, setWeather] = useState<HeaderWeather | null>(null);

    useEffect(() => {
        const userLoc = getUserLocation();
        const loc = userLoc ?? REYKJAVIK;
        const cached = getCached(loc.lat, loc.lng);
        if (cached) {
            setWeather(cached);
            return;
        }

        const controller = new AbortController();
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=weather_code,temperature_2m,wind_speed_10m&timezone=auto`;

        fetch(url, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (data.current) {
                    const w: HeaderWeather = {
                        weatherCode: data.current.weather_code ?? 0,
                        temperature: data.current.temperature_2m ?? 0,
                        windSpeed: data.current.wind_speed_10m ?? 0,
                    };
                    setWeather(w);
                    setCache(w, loc.lat, loc.lng);
                }
            })
            .catch(() => { /* fail silently */ });

        return () => controller.abort();
    }, []);

    return weather;
}

import { useQuery } from '@tanstack/react-query';

export interface HeaderWeather {
    weatherCode: number;
    temperature: number;
    windSpeed: number;
}

const REYKJAVIK = { lat: 64.1466, lng: -21.9426 };

function getUserLocation(): { lat: number; lng: number } | null {
    try {
        const raw = sessionStorage.getItem('utanvega-user-loc');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function useHeaderWeather() {
    const userLoc = getUserLocation();
    const loc = userLoc ?? REYKJAVIK;
    // Round to 1 decimal place (~11km precision) for cache key stability
    const roundedLat = Math.round(loc.lat * 10) / 10;
    const roundedLng = Math.round(loc.lng * 10) / 10;

    const { data: weather = null } = useQuery<HeaderWeather | null>({
        queryKey: ['header-weather', roundedLat, roundedLng],
        queryFn: ({ signal }) => {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLng}&current=weather_code,temperature_2m,wind_speed_10m&timezone=auto`;
            return fetch(url, { signal })
                .then(res => res.json())
                .then(data => {
                    if (!data.current) return null;
                    return {
                        weatherCode: data.current.weather_code ?? 0,
                        temperature: data.current.temperature_2m ?? 0,
                        windSpeed: data.current.wind_speed_10m ?? 0,
                    } as HeaderWeather;
                });
        },
        staleTime: 10 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
    });

    return weather;
}

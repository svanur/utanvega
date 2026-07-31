import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

interface MapFollowControllerProps {
    followMe: boolean;
    userLocation: { lat: number; lng: number } | null;
    returnCenter: [number, number];
    returnZoom: number;
    onDrag: () => void;
}

export default function MapFollowController({
    followMe,
    userLocation,
    returnCenter,
    returnZoom,
    onDrag,
}: MapFollowControllerProps) {
    const map = useMap();
    const wasFollowing = useRef(false);
    useMapEvents({ dragstart: onDrag });
    useEffect(() => {
        if (followMe && userLocation) {
            wasFollowing.current = true;
            map.setView([userLocation.lat, userLocation.lng], map.getZoom());
        } else if (!followMe && wasFollowing.current) {
            wasFollowing.current = false;
            map.setView(returnCenter, returnZoom);
        }
    }, [followMe, userLocation, map, returnCenter, returnZoom]);
    return null;
}

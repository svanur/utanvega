import { useEffect, useRef, useState, useCallback } from 'react';

interface UseShakeOptions {
    threshold?: number;    // acceleration threshold (m/s²)
    cooldown?: number;     // ms between shakes
    onShake: () => void;
}

/**
 * Detects device shake via DeviceMotionEvent.
 * iOS 13+ requires explicit permission via DeviceMotionEvent.requestPermission().
 */
export function useShake({ threshold = 25, cooldown = 2000, onShake }: UseShakeOptions) {
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [supported, setSupported] = useState(false);
    const lastShakeRef = useRef(0);
    const onShakeRef = useRef(onShake);

    useEffect(() => {
        onShakeRef.current = onShake;
    }, [onShake]);

    // Check if DeviceMotion is available
    useEffect(() => {
        setSupported(typeof DeviceMotionEvent !== 'undefined');
    }, []);

    const requestPermission = useCallback(async () => {
        // iOS 13+ requires explicit permission
        const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
        if (typeof DME.requestPermission === 'function') {
            try {
                const result = await DME.requestPermission();
                if (result === 'granted') {
                    setPermissionGranted(true);
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        }
        // Android / older iOS — no permission needed
        setPermissionGranted(true);
        return true;
    }, []);

    useEffect(() => {
        if (!supported || !permissionGranted) return;

        const handleMotion = (e: DeviceMotionEvent) => {
            const acc = e.accelerationIncludingGravity;
            if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

            const force = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
            const now = Date.now();

            if (force > threshold && now - lastShakeRef.current > cooldown) {
                lastShakeRef.current = now;
                onShakeRef.current();
            }
        };

        window.addEventListener('devicemotion', handleMotion);
        return () => window.removeEventListener('devicemotion', handleMotion);
    }, [supported, permissionGranted, threshold, cooldown]);

    return { supported, permissionGranted, requestPermission };
}

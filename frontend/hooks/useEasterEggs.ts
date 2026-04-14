import { useState, useEffect, useCallback, useRef } from 'react';

export type EasterEgg = 'konami' | 'ultra' | 'matrix' | 'originals' | null;

const KONAMI_CODE = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a'
];

export function useEasterEggs() {
    const [activeEgg, setActiveEgg] = useState<EasterEgg>(null);
    const konamiIndex = useRef(0);
    const typedChars = useRef('');
    const typedTimer = useRef<ReturnType<typeof setTimeout>>();
    const activeRef = useRef(activeEgg);

    useEffect(() => { activeRef.current = activeEgg; }, [activeEgg]);

    const triggerEgg = useCallback((egg: EasterEgg) => {
        if (!activeRef.current) setActiveEgg(egg);
    }, []);

    const clearEgg = useCallback(() => {
        setActiveEgg(null);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape dismisses active egg
            if (e.key === 'Escape' && activeRef.current) {
                clearEgg();
                return;
            }

            if (activeRef.current) return;

            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // Konami code works everywhere (arrow keys + letters)
            const expected = KONAMI_CODE[konamiIndex.current];
            if (e.key && (e.key === expected || e.key.toLowerCase() === expected)) {
                konamiIndex.current++;
                if (konamiIndex.current === KONAMI_CODE.length) {
                    triggerEgg('konami');
                    konamiIndex.current = 0;
                }
            } else if (e.key && e.key === KONAMI_CODE[0]) {
                konamiIndex.current = 1;
            } else {
                konamiIndex.current = 0;
            }

            // Typed word checks only outside inputs
            if (!isInput && e.key && e.key.length === 1) {
                clearTimeout(typedTimer.current);
                typedChars.current += e.key.toLowerCase();

                if (typedChars.current.endsWith('ultra')) {
                    triggerEgg('ultra');
                    typedChars.current = '';
                } else if (typedChars.current.endsWith('matrix')) {
                    triggerEgg('matrix');
                    typedChars.current = '';
                }

                if (typedChars.current.length > 30) {
                    typedChars.current = typedChars.current.slice(-15);
                }

                typedTimer.current = setTimeout(() => {
                    typedChars.current = '';
                }, 3000);
            }
        };

        // Custom event for search-triggered easter eggs
        const handleCustomEgg = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.egg) triggerEgg(detail.egg);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('easter-egg', handleCustomEgg);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('easter-egg', handleCustomEgg);
            clearTimeout(typedTimer.current);
        };
    }, [triggerEgg, clearEgg]);

    return { activeEgg, triggerEgg, clearEgg };
}

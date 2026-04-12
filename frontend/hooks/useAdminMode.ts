import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'utanvega-admin';
const SECRET_WORD = 'mellon';
const URL_PARAM_KEY = 'speak';
const URL_PARAM_VALUE = 'friend';

const GANDALF_QUOTES = [
    { is: 'Þú skalt... komast framhjá! Velkomin/n, vinur.', en: 'You shall... pass! Welcome, friend.' },
    { is: 'Allt sem við þurfum að ákveða er hvað við gerum við leiðirnar sem okkur eru gefnar.', en: 'All we have to decide is what to do with the trails that are given to us.' },
    { is: 'Geymdu það. Geymdu það öruggt.', en: 'Keep it secret. Keep it safe.' },
    { is: 'Galdramaður kemur aldrei of seint, hann kemur einmitt þegar hann ætlar sér.', en: 'A wizard is never late. He arrives precisely when he means to.' },
    { is: 'Ég er Gandálfur, og Gandálfur þýðir... mig!', en: 'I am Gandalf, and Gandalf means... me!' },
];

export function useAdminMode() {
    const [isAdmin, setIsAdmin] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const [gandalfQuote, setGandalfQuote] = useState<{ is: string; en: string } | null>(null);

    const activate = useCallback(() => {
        setIsAdmin(true);
        try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
        const quote = GANDALF_QUOTES[Math.floor(Math.random() * GANDALF_QUOTES.length)];
        setGandalfQuote(quote);
    }, []);

    const deactivate = useCallback(() => {
        setIsAdmin(false);
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }, []);

    const dismissGandalf = useCallback(() => {
        setGandalfQuote(null);
    }, []);

    // Check URL param on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get(URL_PARAM_KEY) === URL_PARAM_VALUE && !isAdmin) {
            activate();
            // Clean URL
            params.delete(URL_PARAM_KEY);
            const newUrl = params.toString()
                ? `${window.location.pathname}?${params.toString()}`
                : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for secret word typed anywhere
    useEffect(() => {
        if (isAdmin) return;

        let buffer = '';
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            buffer += e.key.toLowerCase();
            if (buffer.length > SECRET_WORD.length) {
                buffer = buffer.slice(-SECRET_WORD.length);
            }
            if (buffer === SECRET_WORD) {
                activate();
                buffer = '';
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAdmin, activate]);

    return { isAdmin, activate, deactivate, gandalfQuote, dismissGandalf };
}

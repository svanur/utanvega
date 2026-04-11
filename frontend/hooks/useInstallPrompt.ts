import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [dismissed, setDismissed] = useState(() => {
        const val = localStorage.getItem('utanvega-install-dismissed');
        if (!val) return false;
        // Re-show after 7 days
        const dismissedAt = parseInt(val, 10);
        return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
    });

    useEffect(() => {
        // Check if already installed as standalone PWA
        if (window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as unknown as Record<string, unknown>).standalone === true) {
            setIsInstalled(true);
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        const installedHandler = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) return false;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            setDeferredPrompt(null);
        }
        return outcome === 'accepted';
    }, [deferredPrompt]);

    const dismiss = useCallback(() => {
        setDismissed(true);
        localStorage.setItem('utanvega-install-dismissed', Date.now().toString());
    }, []);

    const canPrompt = !!deferredPrompt && !isInstalled;
    const showBanner = canPrompt && !dismissed;

    // iOS doesn't fire beforeinstallprompt — detect and show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
    const showIOSHint = isIOS && !isInstalled && !dismissed;

    return { canPrompt, isInstalled, showBanner, showIOSHint, install, dismiss };
}

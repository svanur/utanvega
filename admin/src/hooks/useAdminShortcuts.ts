import { useEffect, useRef } from 'react';
import type { PageKey } from '../types/PageKey';

interface UseAdminShortcutsOptions {
    onNavigate: (page: PageKey) => void;
    onToggleSidebar: () => void;
    onNewTrail: () => void;
    onRefresh: () => void;
    onToggleTools: () => void;
    onShowHelp: () => void;
    onFocusSearch: () => void;
    onPendingNavigation?: (pending: boolean) => void;
    currentPage: PageKey;
}

// g+letter → page mapping (mnemonic letters match the underlined char in the sidebar label)
export const GO_TO_PAGES: Record<string, PageKey> = {
    e: 'events',
    t: 'trails',
    l: 'locations',
    h: 'health',
    v: 'event-health',   // e[v]ent health
    d: 'edition-health', // e[d]ition health
    m: 'map',
    s: 'tags',          // tag[s]
    a: 'analytics',
    f: 'features',
    r: 'hero-themes',   // he[r]o themes
    n: 'sponsors',      // spo[n]sors
    p: 'pools',
    o: 'organizers',    // [o]rganizers
    i: 'translation-health', // translat[i]ons
};

function isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

export function useAdminShortcuts({
    onNavigate,
    onToggleSidebar,
    onNewTrail,
    onRefresh,
    onToggleTools,
    onShowHelp,
    onFocusSearch,
    onPendingNavigation,
    currentPage,
}: UseAdminShortcutsOptions) {
    const pendingG = useRef(false);
    const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onPendingNavigationRef = useRef(onPendingNavigation);
    onPendingNavigationRef.current = onPendingNavigation;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+? — show help (works even in inputs)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '?' || e.key === '/')) {
                e.preventDefault();
                onShowHelp();
                return;
            }

            if (isInputFocused()) return;

            // g+letter navigation
            if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                if (pendingG.current) {
                    pendingG.current = false;
                    if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
                    onPendingNavigationRef.current?.(false);
                    const page = GO_TO_PAGES[e.key.toLowerCase()];
                    if (page) {
                        e.preventDefault();
                        onNavigate(page);
                    }
                    return;
                }

                if (e.key === 'g') {
                    e.preventDefault();
                    pendingG.current = true;
                    onPendingNavigationRef.current?.(true);
                    pendingTimeout.current = setTimeout(() => {
                        pendingG.current = false;
                        onPendingNavigationRef.current?.(false);
                    }, 1500);
                    return;
                }

                // "/" — focus search
                if (e.key === '/') {
                    e.preventDefault();
                    onFocusSearch();
                    return;
                }
            }

            // Alt+letter actions
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onNewTrail(); return; }
                if (e.key === 'r' || e.key === 'R') { e.preventDefault(); onRefresh(); return; }
                if ((e.key === 't' || e.key === 'T') && currentPage === 'trails') { e.preventDefault(); onToggleTools(); return; }
                if (e.key === 's' || e.key === 'S') { e.preventDefault(); onToggleSidebar(); return; }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
        };
    }, [onNavigate, onToggleSidebar, onNewTrail, onRefresh, onToggleTools, onShowHelp, onFocusSearch, currentPage]);
}

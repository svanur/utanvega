import { useEffect } from 'react';

type PageKey = 'trails' | 'locations' | 'health' | 'map' | 'tags' | 'analytics' | 'features' | 'competitions';

interface UseAdminShortcutsOptions {
    onNavigate: (page: PageKey) => void;
    onToggleSidebar: () => void;
    onNewTrail: () => void;
    onRefresh: () => void;
    onToggleTools: () => void;
    onShowHelp: () => void;
    onFocusSearch: () => void;
    currentPage: PageKey;
}

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
    currentPage,
}: UseAdminShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+? (Ctrl+Shift+/) — show help
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '?' || e.key === '/')) {
                e.preventDefault();
                onShowHelp();
                return;
            }

            // Don't intercept when typing in inputs (except for Ctrl combos above)
            if (isInputFocused()) return;

            // Alt+number — navigate
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                const pages: Record<string, PageKey> = {
                    '1': 'trails',
                    '2': 'locations',
                    '3': 'health',
                    '4': 'map',
                    '5': 'tags',
                    '6': 'analytics',
                    '7': 'competitions',
                    '8': 'features',
                };
                if (pages[e.key]) {
                    e.preventDefault();
                    onNavigate(pages[e.key]);
                    return;
                }

                // Alt+N — new trail
                if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    onNewTrail();
                    return;
                }

                // Alt+R — refresh
                if (e.key === 'r' || e.key === 'R') {
                    e.preventDefault();
                    onRefresh();
                    return;
                }

                // Alt+T — toggle tools
                if ((e.key === 't' || e.key === 'T') && currentPage === 'trails') {
                    e.preventDefault();
                    onToggleTools();
                    return;
                }

                // Alt+S — toggle sidebar
                if (e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    onToggleSidebar();
                    return;
                }
            }

            // "/" — focus search (when not in input)
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                onFocusSearch();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNavigate, onToggleSidebar, onNewTrail, onRefresh, onToggleTools, onShowHelp, onFocusSearch, currentPage]);
}

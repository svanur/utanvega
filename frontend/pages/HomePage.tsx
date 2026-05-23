import { useState } from 'react';
import RandomQuote from '../components/RandomQuote';
import Layout from '../components/Layout';
import { TrailList } from '../components/TrailList';
import type { PaletteMode } from '@mui/material';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

type HomePageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
    tagSlug?: string;
    showQuote?: boolean;
};

export default function HomePage({ mode, onToggleMode, tagSlug, showQuote = false }: HomePageProps) {
    const { isEnabled } = useFeatureFlags();
    const [viewMode, setViewMode] = useState(() => {
        try { return localStorage.getItem('utanvega-view-mode') || 'list'; } catch { return 'list'; }
    });
    const maxWidth = viewMode === 'table' ? false as const : 'md' as const;
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth={maxWidth}>
            {showQuote && isEnabled('random_quote') && <RandomQuote />}
            <TrailList tagSlug={tagSlug} onViewModeChange={setViewMode} />
        </Layout>
    );
}
import { useState } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';
import RandomQuote from '../components/RandomQuote';
import Layout from '../components/Layout';
import { TrailList } from '../components/TrailList';
import PartnerLinks from '../components/PartnerLinks';
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
    const { t } = useTranslation();
    usePageTitle(t('nav.trails'));
    const [viewMode, setViewMode] = useState(() => {
        try { return localStorage.getItem('utanvega-view-mode') || 'list'; } catch { return 'list'; }
    });
    const maxWidth = viewMode === 'table' ? 'lg' as const : 'md' as const;
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth={maxWidth} bottomContent={<PartnerLinks />}>
            {showQuote && isEnabled('random_quote') && <RandomQuote />}
            <TrailList tagSlug={tagSlug} onViewModeChange={setViewMode} />
        </Layout>
    );
}
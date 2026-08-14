import { useState } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';
import HeroBanner from '../components/HeroBanner';
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
    const heroBanner = showQuote && isEnabled('hero_banner') ? <HeroBanner /> : undefined;
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth={maxWidth} bottomContent={<PartnerLinks />} heroBanner={heroBanner}>
            <TrailList tagSlug={tagSlug} onViewModeChange={setViewMode} />
        </Layout>
    );
}
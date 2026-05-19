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

export default function HomePage({ mode, onToggleMode, tagSlug, showQuote = true }: HomePageProps) {
    const { isEnabled } = useFeatureFlags();
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            {showQuote && isEnabled('random_quote') && <RandomQuote />}
            <TrailList tagSlug={tagSlug} />
        </Layout>
    );
}
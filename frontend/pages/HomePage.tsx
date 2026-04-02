import Header from '../components/Header';
import Layout from '../components/Layout';
import { TrailList } from '../components/TrailList';
import type { PaletteMode } from '@mui/material';

type HomePageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
    tagSlug?: string;
};

export default function HomePage({ mode, onToggleMode, tagSlug }: HomePageProps) {
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Header />
            <TrailList tagSlug={tagSlug} />
        </Layout>
    );
}
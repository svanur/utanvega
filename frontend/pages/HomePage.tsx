import { Paper } from '@mui/material';
import Header from '../components/Header';
import Layout from '../components/Layout';
import type { PaletteMode } from '@mui/material';

type HomePageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function HomePage({ mode, onToggleMode }: HomePageProps) {
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 4 } }}>
                <Header />
            </Paper>
        </Layout>
    );
}
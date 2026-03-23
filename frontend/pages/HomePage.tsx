import { Paper } from '@mui/material';
import Header from '../components/Header';
import Layout from '../components/Layout';

export default function HomePage() {
    return (
        <Layout>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 4 } }}>
                <Header />
            </Paper>
        </Layout>
    );
}
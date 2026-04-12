import { Box, Typography, Chip } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import Layout from '../components/Layout';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

interface FunPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function FunPage({ mode, onToggleMode }: FunPageProps) {
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontSize: '5rem', mb: 2 }}>🧙‍♂️</Typography>
                <Typography variant="h3" gutterBottom sx={{ fontFamily: '"Georgia", serif' }}>
                    This is fun
                </Typography>
                <Chip
                    icon={<AutoFixHighIcon />}
                    label="Admin Only"
                    color="warning"
                    variant="outlined"
                    sx={{ mt: 2 }}
                />
            </Box>
        </Layout>
    );
}

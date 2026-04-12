import { Box, Typography, Chip } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import Layout from '../components/Layout';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import GuessTheTrail from '../components/GuessTheTrail';

interface FunPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function FunPage({ mode, onToggleMode }: FunPageProps) {
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom sx={{ fontFamily: '"Georgia", serif' }}>
                    🧙‍♂️ {' '}
                    <Chip
                        icon={<AutoFixHighIcon />}
                        label="Admin Only"
                        color="warning"
                        variant="outlined"
                        size="small"
                    />
                </Typography>
            </Box>

            <GuessTheTrail />
        </Layout>
    );
}

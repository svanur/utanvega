import { useState } from 'react';
import { Box, Typography, Chip, Tabs, Tab } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import Layout from '../components/Layout';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import GuessTheTrail from '../components/GuessTheTrail';
import HigherLower from '../components/HigherLower';
import { useTranslation } from 'react-i18next';

interface FunPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function FunPage({ mode, onToggleMode }: FunPageProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState(0);

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

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                centered
                sx={{ mb: 3 }}
            >
                <Tab label={`🗺️ ${t('fun.guessTheTrail')}`} />
                <Tab label={`📊 ${t('fun.higherLower')}`} />
            </Tabs>

            {tab === 0 && <GuessTheTrail />}
            {tab === 1 && <HigherLower />}
        </Layout>
    );
}

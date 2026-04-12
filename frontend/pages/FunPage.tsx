import { useMemo, useState } from 'react';
import { Box, Typography, Chip, Tabs, Tab } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import Layout from '../components/Layout';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import GuessTheTrail from '../components/GuessTheTrail';
import HigherLower from '../components/HigherLower';
import TrailGeoGuesser from '../components/TrailGeoGuesser';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

interface FunPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

interface GameDef {
    key: string;
    flag: string;
    label: string;
    component: React.ReactNode;
}

export default function FunPage({ mode, onToggleMode }: FunPageProps) {
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();
    const [tab, setTab] = useState(0);

    const games: GameDef[] = useMemo(() => [
        { key: 'guess', flag: 'game_guess_the_trail', label: `🗺️ ${t('fun.guessTheTrail')}`, component: <GuessTheTrail /> },
        { key: 'hl', flag: 'game_higher_lower', label: `📊 ${t('fun.higherLower')}`, component: <HigherLower /> },
        { key: 'geo', flag: 'game_geoguesser', label: `📍 ${t('fun.geoGuesser')}`, component: <TrailGeoGuesser /> },
    ], [t]);

    const enabledGames = games.filter(g => isEnabled(g.flag));

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

            {enabledGames.length === 0 ? (
                <Typography textAlign="center" color="text.secondary">
                    {t('fun.noGamesEnabled')}
                </Typography>
            ) : (
                <>
                    <Tabs
                        value={tab >= enabledGames.length ? 0 : tab}
                        onChange={(_, v) => setTab(v)}
                        centered
                        sx={{ mb: 3 }}
                    >
                        {enabledGames.map(g => (
                            <Tab key={g.key} label={g.label} />
                        ))}
                    </Tabs>

                    {enabledGames[tab >= enabledGames.length ? 0 : tab]?.component}
                </>
            )}
        </Layout>
    );
}

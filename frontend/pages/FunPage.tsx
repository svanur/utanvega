import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, Tabs, Tab, Stack } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import Layout from '../components/Layout';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ShareButtons from '../components/ShareButtons';
import GuessTheTrail from '../components/GuessTheTrail';
import HigherLower from '../components/HigherLower';
import TrailGeoGuesser from '../components/TrailGeoGuesser';
import GuessByElevation from '../components/GuessByElevation';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

interface FunPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

interface GameDef {
    key: string;
    slug: string;
    flag: string;
    label: string;
    component: React.ReactNode;
}

export default function FunPage({ mode, onToggleMode }: FunPageProps) {
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();
    const { game } = useParams<{ game: string }>();
    const navigate = useNavigate();
    const [tab, setTab] = useState(0);

    const games: GameDef[] = useMemo(() => [
        { key: 'guess', slug: 'guess', flag: 'game_guess_the_trail', label: `🗺️ ${t('fun.guessTheTrail')}`, component: <GuessTheTrail /> },
        { key: 'elev', slug: 'elevation', flag: 'game_guess_elevation', label: `📈 ${t('fun.guessByElevation')}`, component: <GuessByElevation /> },
        { key: 'hl', slug: 'higher-lower', flag: 'game_higher_lower', label: `📊 ${t('fun.higherLower')}`, component: <HigherLower /> },
        { key: 'geo', slug: 'geoguesser', flag: 'game_geoguesser', label: `📍 ${t('fun.geoGuesser')}`, component: <TrailGeoGuesser /> },
    ], [t]);

    const enabledGames = games.filter(g => isEnabled(g.flag));

    // Sync tab index from URL
    useEffect(() => {
        if (!game) {
            if (enabledGames.length > 0) {
                navigate(`/fun/${enabledGames[0].slug}`, { replace: true });
            }
            return;
        }
        const idx = enabledGames.findIndex(g => g.slug === game);
        setTab(idx >= 0 ? idx : 0);
    }, [game, enabledGames, navigate]);

    const handleTabChange = (_: React.SyntheticEvent, newIdx: number) => {
        const selected = enabledGames[newIdx];
        if (selected) navigate(`/fun/${selected.slug}`);
    };

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
                    <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 3, position: 'relative' }}>
                        <Tabs
                            value={tab >= enabledGames.length ? 0 : tab}
                            onChange={handleTabChange}
                            centered
                        >
                            {enabledGames.map(g => (
                                <Tab key={g.key} label={g.label} />
                            ))}
                        </Tabs>
                        <Box sx={{ position: 'absolute', right: 0 }}>
                            <ShareButtons title={enabledGames[tab >= enabledGames.length ? 0 : tab]?.label ?? ''} />
                        </Box>
                    </Stack>

                    {enabledGames[tab >= enabledGames.length ? 0 : tab]?.component}
                </>
            )}
        </Layout>
    );
}

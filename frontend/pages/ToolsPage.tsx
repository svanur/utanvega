import { useMemo } from 'react';
import type { PaletteMode } from '@mui/material';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PaceCalculator from '../components/PaceCalculator';
import RacePredictor from '../components/RacePredictor';
import TrailRacePredictor from '../components/TrailRacePredictor';
import PaceChart from '../components/PaceChart';
import TrainingPaces from '../components/TrainingPaces';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import TimerIcon from '@mui/icons-material/Timer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TerrainIcon from '@mui/icons-material/Terrain';
import TableChartIcon from '@mui/icons-material/TableChart';
import SpeedIcon from '@mui/icons-material/Speed';

interface ToolDef {
    key: string;
    flag: string;
    label: string;
    icon: React.ReactElement;
    component: React.ReactElement;
}

export default function ToolsPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();
    const { toolKey } = useParams<{ toolKey?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const prefilledTrail = searchParams.get('trail') ?? undefined;

    const allTools: ToolDef[] = [
        { key: 'pace-calculator', flag: 'tool_pace_calculator', label: t('tools.paceCalc.title'), icon: <TimerIcon />, component: <PaceCalculator /> },
        { key: 'pace-chart', flag: 'tool_pace_chart', label: t('tools.paceChart.title'), icon: <TableChartIcon />, component: <PaceChart /> },
        { key: 'training-paces', flag: 'tool_training_paces', label: t('tools.trainingPaces.title'), icon: <SpeedIcon />, component: <TrainingPaces /> },
        { key: 'race-predictor', flag: 'tool_race_predictor', label: t('tools.racePredictor.title'), icon: <EmojiEventsIcon />, component: <RacePredictor /> },
        { key: 'trail-predictor', flag: 'tool_trail_predictor', label: t('tools.trailPredictor.title'), icon: <TerrainIcon />, component: <TrailRacePredictor prefilledTrailSlug={prefilledTrail} /> },
    ];

    const tools = allTools.filter(tool => isEnabled(tool.flag));

    const activeTab = useMemo(() => {
        if (!toolKey) return 0;
        const idx = tools.findIndex(t => t.key === toolKey);
        return idx >= 0 ? idx : 0;
    }, [toolKey, tools]);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: tools[activeTab]?.key === 'pace-chart' ? { xs: '100%', md: 960 } : 600, mx: 'auto', px: 2, py: 3, transition: 'max-width 0.3s' }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                    🛠️ {t('tools.title')}
                </Typography>

                {tools.length === 0 ? (
                    <Typography color="text.secondary">{t('tools.noToolsEnabled')}</Typography>
                ) : (
                    <>
                        {tools.length > 1 && (
                            <Tabs
                                value={activeTab}
                                onChange={(_, v) => navigate(`/tools/${tools[v].key}`, { replace: true })}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{ mb: 2 }}
                            >
                                {tools.map((tool) => (
                                    <Tab key={tool.key} icon={tool.icon} label={tool.label} iconPosition="start" />
                                ))}
                            </Tabs>
                        )}
                        {tools[activeTab]?.component}
                    </>
                )}
            </Box>
        </Layout>
    );
}

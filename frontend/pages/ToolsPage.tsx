import { useState } from 'react';
import type { PaletteMode } from '@mui/material';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import PaceCalculator from '../components/PaceCalculator';
import RacePredictor from '../components/RacePredictor';
import TrailRacePredictor from '../components/TrailRacePredictor';
import PaceChart from '../components/PaceChart';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import TimerIcon from '@mui/icons-material/Timer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TerrainIcon from '@mui/icons-material/Terrain';
import TableChartIcon from '@mui/icons-material/TableChart';

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
    const [tab, setTab] = useState(0);

    const allTools: ToolDef[] = [
        { key: 'pace', flag: 'tool_pace_calculator', label: t('tools.paceCalc.title'), icon: <TimerIcon />, component: <PaceCalculator /> },
        { key: 'predictor', flag: 'tool_race_predictor', label: t('tools.racePredictor.title'), icon: <EmojiEventsIcon />, component: <RacePredictor /> },
        { key: 'trail-predictor', flag: 'tool_trail_predictor', label: t('tools.trailPredictor.title'), icon: <TerrainIcon />, component: <TrailRacePredictor /> },
        { key: 'pace-chart', flag: 'tool_pace_chart', label: t('tools.paceChart.title'), icon: <TableChartIcon />, component: <PaceChart /> },
    ];

    const tools = allTools.filter(tool => isEnabled(tool.flag));
    const safeTab = tab >= tools.length ? 0 : tab;

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, py: 3 }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                    🛠️ {t('tools.title')}
                </Typography>

                {tools.length === 0 ? (
                    <Typography color="text.secondary">{t('tools.noToolsEnabled')}</Typography>
                ) : (
                    <>
                        {tools.length > 1 && (
                            <Tabs
                                value={safeTab}
                                onChange={(_, v) => setTab(v)}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{ mb: 2 }}
                            >
                                {tools.map((tool) => (
                                    <Tab key={tool.key} icon={tool.icon} label={tool.label} iconPosition="start" />
                                ))}
                            </Tabs>
                        )}
                        {tools[safeTab]?.component}
                    </>
                )}
            </Box>
        </Layout>
    );
}

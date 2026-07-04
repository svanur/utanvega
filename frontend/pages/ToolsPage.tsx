import { useMemo } from 'react';
import type { PaletteMode } from '@mui/material';
import { Box, Tabs, Tab, Typography, Card, CardActionArea, CardContent, IconButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Layout from '../components/Layout';
import PaceCalculator from '../components/PaceCalculator';
import RacePredictor from '../components/RacePredictor';
import TrailRacePredictor from '../components/TrailRacePredictor';
import PaceChart from '../components/PaceChart';
import TrainingPaces from '../components/TrainingPaces';
import AgeGradingCalculator from '../components/AgeGradingCalculator';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import TimerIcon from '@mui/icons-material/Timer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TerrainIcon from '@mui/icons-material/Terrain';
import TableChartIcon from '@mui/icons-material/TableChart';
import SpeedIcon from '@mui/icons-material/Speed';
import PersonIcon from '@mui/icons-material/Person';

interface ToolDef {
    key: string;
    flag: string;
    label: string;
    desc: string;
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
    const prefilledFrom = searchParams.get('from') ?? undefined;
    const prefilledTime = searchParams.get('time') ?? undefined;

    const allTools: ToolDef[] = [
        { key: 'pace-calculator',  flag: 'tool_pace_calculator',  label: t('tools.paceCalc.title'),       desc: t('tools.paceCalc.desc'),       icon: <TimerIcon />,       component: <PaceCalculator /> },
        { key: 'pace-chart',       flag: 'tool_pace_chart',        label: t('tools.paceChart.title'),      desc: t('tools.paceChart.desc'),      icon: <TableChartIcon />,  component: <PaceChart /> },
        { key: 'training-paces',   flag: 'tool_training_paces',    label: t('tools.trainingPaces.title'),  desc: t('tools.trainingPaces.desc'),  icon: <SpeedIcon />,       component: <TrainingPaces /> },
        { key: 'race-predictor',   flag: 'tool_race_predictor',    label: t('tools.racePredictor.title'),  desc: t('tools.racePredictor.desc'),  icon: <EmojiEventsIcon />, component: <RacePredictor /> },
        { key: 'age-grading',      flag: 'tool_age_grading',       label: t('tools.ageGrading.title'),     desc: t('tools.ageGrading.desc'),     icon: <PersonIcon />,      component: <AgeGradingCalculator /> },
        { key: 'trail-predictor',  flag: 'tool_trail_predictor',   label: t('tools.trailPredictor.title'), desc: t('tools.trailPredictor.desc'), icon: <TerrainIcon />,     component: <TrailRacePredictor prefilledTrailSlug={prefilledTrail} prefilledFromSlug={prefilledFrom} prefilledTime={prefilledTime} /> },
    ];

    const tools = allTools.filter(tool => isEnabled(tool.flag));

    const activeTool = toolKey ? tools.find(t => t.key === toolKey) ?? null : null;

    const activeTab = useMemo(() => {
        if (!activeTool) return 0;
        const idx = tools.findIndex(t => t.key === activeTool.key);
        return idx >= 0 ? idx : 0;
    }, [activeTool, tools]);

    // Landing page
    if (!toolKey) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, py: 3 }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                        🛠️ {t('tools.title')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                        {t('tools.subtitle')}
                    </Typography>

                    {tools.length === 0 ? (
                        <Typography color="text.secondary">{t('tools.noToolsEnabled')}</Typography>
                    ) : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                            {tools.map(tool => (
                                <Card key={tool.key} variant="outlined" sx={{ borderRadius: 2 }}>
                                    <CardActionArea onClick={() => navigate(`/tools/${tool.key}`)} sx={{ height: '100%' }}>
                                        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'primary.main' }}>
                                                {tool.icon}
                                                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                                                    {tool.label}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary">
                                                {tool.desc}
                                            </Typography>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            ))}
                        </Box>
                    )}
                </Box>
            </Layout>
        );
    }

    // Individual tool page
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: activeTool?.key === 'pace-chart' ? { xs: '100%', md: 960 } : 600, mx: 'auto', px: 2, py: 3, transition: 'max-width 0.3s' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate('/tools')} aria-label="back to tools">
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="body2" color="text.secondary" sx={{ cursor: 'pointer' }} onClick={() => navigate('/tools')}>
                        {t('tools.title')}
                    </Typography>
                </Box>

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

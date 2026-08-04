import type { PaletteMode } from '@mui/material';
import { Box, Typography, Card, CardContent, CardActionArea, Chip, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

interface TripEntry {
    labelKey: string;
    datesKey: string;
    path: string;
    status: 'completed' | 'upcoming' | 'open';
}

const trips: TripEntry[] = [
    {
        labelKey: 'runningTrips.trip2026Switzerland.label',
        datesKey: 'runningTrips.trip2026Switzerland.dates',
        path: '/shop/running-trip/2026/switzerland',
        status: 'completed',
    },
];

export default function RunningTripsPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const statusColor = (status: TripEntry['status']) => {
        if (status === 'open') return 'success' as const;
        if (status === 'upcoming') return 'primary' as const;
        return 'default' as const;
    };

    const statusLabel = (status: TripEntry['status']) => {
        if (status === 'open') return t('runningTrips.statusOpen');
        if (status === 'upcoming') return t('runningTrips.statusUpcoming');
        return t('runningTrips.statusCompleted');
    };

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth="sm">
            <Box sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t('runningTrips.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    {t('runningTrips.intro')}
                </Typography>

                <Stack spacing={2}>
                    {trips.map((trip) => (
                        <Card key={trip.path} variant="outlined">
                            <CardActionArea onClick={() => navigate(trip.path)}>
                                <CardContent>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
                                        <Typography variant="h6" fontWeight={600}>
                                            {t(trip.labelKey)}
                                        </Typography>
                                        <Chip
                                            label={statusLabel(trip.status)}
                                            size="small"
                                            color={statusColor(trip.status)}
                                            variant={trip.status === 'completed' ? 'outlined' : 'filled'}
                                        />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {t(trip.datesKey)}
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    ))}
                </Stack>
            </Box>
        </Layout>
    );
}

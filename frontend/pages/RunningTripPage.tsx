import type { PaletteMode } from '@mui/material';
import { Box, Typography, Chip, Divider, Button, Stack, Table, TableBody, TableRow, TableCell } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

export default function RunningTripPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth="sm">
            <Box sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t('runningTrip.title')}
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('runningTrip.subtitle')}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
                    <Chip label="3.–9. september 2026" color="primary" />
                    <Chip label="Kandersteg, Sviss" variant="outlined" />
                    <Chip label="10–24 þátttakendur" variant="outlined" />
                </Stack>

                <Typography variant="body1" sx={{ mb: 3 }}>
                    {t('runningTrip.description')}
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('runningTrip.itinerary')}
                </Typography>
                <Table size="small" sx={{ mb: 3 }}>
                    <TableBody>
                        {[
                            { day: t('runningTrip.day1'), route: 'Oeschinensee', km: '12 km' },
                            { day: t('runningTrip.day2'), route: 'Sonnbühel & Gasterntal', km: '17 km' },
                            { day: t('runningTrip.day3'), route: 'Blausee', km: '9,5 km' },
                            { day: t('runningTrip.day4'), route: t('runningTrip.restDay'), km: '—' },
                            { day: t('runningTrip.day5'), route: 'Alpschelehubel', km: '15 km' },
                        ].map((row) => (
                            <TableRow key={row.day}>
                                <TableCell sx={{ fontWeight: 600, pr: 2 }}>{row.day}</TableCell>
                                <TableCell>{row.route}</TableCell>
                                <TableCell align="right" sx={{ color: 'text.secondary' }}>{row.km}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('runningTrip.included')}
                </Typography>
                <Stack spacing={0.5} sx={{ mb: 3 }}>
                    {[
                        t('runningTrip.inc1'),
                        t('runningTrip.inc2'),
                        t('runningTrip.inc3'),
                        t('runningTrip.inc4'),
                        t('runningTrip.inc5'),
                    ].map((item) => (
                        <Typography key={item} variant="body2">✓ {item}</Typography>
                    ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('runningTrip.pricing')}
                </Typography>
                <Stack spacing={0.5} sx={{ mb: 3 }}>
                    <Typography variant="body1" fontWeight={600}>240.000 kr. <Typography component="span" variant="body2" color="text.secondary">({t('runningTrip.standardRoom')})</Typography></Typography>
                    <Typography variant="body1" fontWeight={600}>300.000 kr. <Typography component="span" variant="body2" color="text.secondary">({t('runningTrip.suiteUpgrade')})</Typography></Typography>
                </Stack>

                <Button
                    variant="contained"
                    size="large"
                    href="https://verslun.hlaupadagskra.is"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ textTransform: 'none', mr: 1 }}
                >
                    {t('runningTrip.register')}
                </Button>
                <Button
                    variant="outlined"
                    size="large"
                    href="mailto:info@hlaupadagskra.is?subject=Hlaupaferð í Sviss 2026"
                    sx={{ textTransform: 'none' }}
                >
                    {t('runningTrip.contact')}
                </Button>
            </Box>
        </Layout>
    );
}

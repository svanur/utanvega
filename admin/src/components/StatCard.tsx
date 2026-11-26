import { Box, Paper, Stack, Typography } from '@mui/material';

/**
 * Small KPI tile: title, big value, optional subtitle, and a tinted icon chip.
 *
 * Extracted from AnalyticsPage.tsx (where it originated) so AdventEntriesPage.tsx (#1895) can
 * reuse it without duplicating the markup — the icon/color props keep it page-agnostic.
 */
export default function StatCard({ title, value, subtitle, icon, color }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
}) {
    return (
        <Paper elevation={2} sx={{ p: 2.5, height: '100%' }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        {title}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
                        {value}
                    </Typography>
                    {subtitle && (
                        <Typography variant="caption" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </Box>
                <Box sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: `${color}15`,
                    color: color,
                    display: 'flex',
                }}>
                    {icon}
                </Box>
            </Stack>
        </Paper>
    );
}

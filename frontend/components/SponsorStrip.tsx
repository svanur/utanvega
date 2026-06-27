import { Box, Stack } from '@mui/material';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { SPONSORS } from '../data/sponsors';

export default function SponsorStrip() {
    const { isEnabled } = useFeatureFlags();
    const active = SPONSORS.filter(s => isEnabled(s.flag));
    if (active.length === 0) return null;

    return (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', py: 1 }}>
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={4}>
                {active.map(s => (
                    <a key={s.flag} href={s.href} target="_blank" rel="noopener noreferrer">
                        <Box
                            component="img"
                            src={s.img}
                            alt={s.name}
                            sx={{ height: 36, objectFit: 'contain', display: 'block', opacity: 0.85, '&:hover': { opacity: 1 } }}
                        />
                    </a>
                ))}
            </Stack>
        </Box>
    );
}

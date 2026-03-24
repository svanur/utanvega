import { Box, Chip, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CircularProgress from '@mui/material/CircularProgress';
import { useHealth } from '../hooks/useHealth';

export default function FooterStatus() {
    const { data, loading, error } = useHealth();

    return (
        <Box
            component="footer"
            sx={{
                mt: 'auto',
                px: 2,
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
            }}
        >
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                    🌄Utanvega🏃‍♂️🚴‍
                </Typography>

                {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={14} thickness={5} />
                        <Typography variant="body2" color="text.secondary">
                            Checking API…
                        </Typography>
                    </Stack>
                ) : error ? (
                    <Chip
                        icon={<ErrorOutlineIcon />}
                        label="API unavailable"
                        color="error"
                        variant="outlined"
                        size="small"
                    />
                ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                            icon={<CheckCircleOutlineIcon />}
                            label={`${data?.status ?? 'healthy'} • ${data?.version ?? 'v1'}`}
                            color="success"
                            variant="outlined"
                            size="small"
                        />
                        <Typography variant="caption" color="text.secondary">
                            {data?.service ?? 'backend'}
                        </Typography>
                    </Stack>
                )}
            </Stack>
        </Box>
    );
}

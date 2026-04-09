import { Box, Chip, Stack, Typography, Link as MuiLink } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useHealth } from '../hooks/useHealth';

export default function FooterStatus() {
    const { data, loading, error } = useHealth();
    const { t } = useTranslation();

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
                    🌄Utanvega🏃‍♂️🏃‍♀️🚴‍
                </Typography>
                <MuiLink component={Link} to="/disclaimer" variant="caption" color="text.secondary" underline="hover" sx={{ opacity: 0.7 }}>
                    {t('nav.disclaimer')}
                </MuiLink>

                {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={14} thickness={5} />
                        <Typography variant="body2" color="text.secondary">
                            {t('footer.checkingApi')}
                        </Typography>
                    </Stack>
                ) : error ? (
                    <Chip
                        icon={<ErrorOutlineIcon />}
                        label={t('footer.apiUnavailable')}
                        color="error"
                        variant="outlined"
                        size="small"
                    />
                ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                            icon={<CheckCircleOutlineIcon />}
                            label={`${data?.status ?? t('footer.healthy')} • ${data?.version ?? 'v1'}`}
                            color="success"
                            variant="outlined"
                            size="small"
                        />
                        <Typography variant="caption" color="text.secondary">
                            {data?.service ?? ''}
                        </Typography>
                    </Stack>
                )}
            </Stack>
        </Box>
    );
}

import { Box, Chip, Divider, Stack, Typography, Link as MuiLink } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useHealth } from '../hooks/useHealth';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

export default function FooterStatus() {
    const { data, loading, error } = useHealth();
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();

    return (
        <Box
            component="footer"
            sx={{
                mt: 'auto',
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
            }}
        >
            {/* Main footer links */}
            <Box sx={{ px: 3, py: 3 }}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 3, sm: 6 }}
                    justifyContent="center"
                >
                    {/* Discover */}
                    <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            {t('footer.discover')}
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <MuiLink component={Link} to="/tools" variant="body2" color="text.secondary" underline="hover">{t('tools.title')}</MuiLink>
                            {/* Route is flag-gated, so the link must be too — otherwise it 404s. */}
                            {isEnabled('trail_comparison') && (
                                <MuiLink component={Link} to="/compare" variant="body2" color="text.secondary" underline="hover">{t('compare.title')}</MuiLink>
                            )}
                            <MuiLink component={Link} to="/fun" variant="body2" color="text.secondary" underline="hover">{t('nav.fun')}</MuiLink>
                            <MuiLink component={Link} to="/itra" variant="body2" color="text.secondary" underline="hover">ITRA</MuiLink>
                        </Stack>
                    </Box>

                    {/* Info */}
                    <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            {t('footer.info')}
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <MuiLink component={Link} to="/about" variant="body2" color="text.secondary" underline="hover">{t('nav.aboutUs')}</MuiLink>
                            <MuiLink component={Link} to="/services" variant="body2" color="text.secondary" underline="hover">{t('nav.services')}</MuiLink>
                            <MuiLink component={Link} to="/faq" variant="body2" color="text.secondary" underline="hover">{t('nav.faq')}</MuiLink>
                            <MuiLink component={Link} to="/disclaimer" variant="body2" color="text.secondary" underline="hover">{t('nav.disclaimer')}</MuiLink>
                            <MuiLink component={Link} to="/privacy" variant="body2" color="text.secondary" underline="hover">{t('nav.privacy')}</MuiLink>
                        </Stack>
                    </Box>

                    {/* Follow */}
                    <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            {t('footer.follow')}
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                            {[
                                { label: 'Facebook',         href: 'https://www.facebook.com/hlaupadagskra' },
                                { label: 'Instagram',        href: 'https://www.instagram.com/hlaupadagskra' },
                                { label: 'YouTube · 360° Runs', href: 'https://www.youtube.com/@360RunsIceland' },
                            ].map(({ label, href }) => (
                                <MuiLink key={label} href={href} target="_blank" rel="noopener noreferrer" variant="body2" color="text.secondary" underline="hover"
                                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                    {label}
                                    <OpenInNewIcon sx={{ fontSize: 12 }} />
                                </MuiLink>
                            ))}
                        </Stack>
                    </Box>

                    {/* Contact */}
                    <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            {t('footer.contact')}
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <MuiLink component={Link} to="/contact" variant="body2" color="text.secondary" underline="hover">{t('contact.title')}</MuiLink>
                            <MuiLink component={Link} to="/newsletter" variant="body2" color="text.secondary" underline="hover">{t('newsletter.subscribe')}</MuiLink>
                        </Stack>
                    </Box>
                </Stack>
            </Box>

            <Divider />

            {/* Bottom bar */}
            <Box sx={{ px: 2, py: 1 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                        © {new Date().getFullYear()} Hlaupadagskra.is
                    </Typography>

                    {loading ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={14} thickness={5} />
                            <Typography variant="caption" color="text.secondary">
                                {t('footer.checkingApi')}
                            </Typography>
                        </Stack>
                    ) : error ? (
                        <Chip icon={<ErrorOutlineIcon />} label={t('footer.apiUnavailable')} color="error" variant="outlined" size="small" />
                    ) : (
                        <Chip
                            icon={<CheckCircleOutlineIcon />}
                            // appVersion is the release; `version` is the API contract
                            // version and reads as one when shown here. Omit rather than
                            // print a stand-in, so the chip is never misleading.
                            label={data?.appVersion
                                ? `${data.status ?? t('footer.healthy')} • v${data.appVersion}`
                                : (data?.status ?? t('footer.healthy'))}
                            color="success"
                            variant="outlined"
                            size="small"
                        />
                    )}
                </Stack>
            </Box>
        </Box>
    );
}

import { Container, Typography, Box, Paper, Alert } from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import type { PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import SendTipButton from '../components/SendTipButton';

interface SendCommentsPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function SendCommentsPage({ mode, onToggleMode }: SendCommentsPageProps) {
    const { t } = useTranslation();

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ScienceIcon sx={{ fontSize: 36, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h4" fontWeight={800}>
                            {t('betaComments.title', { defaultValue: 'Beta Feedback' })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('betaComments.subtitle', { defaultValue: 'Help us improve the new hlaupadagskra.is' })}
                        </Typography>
                    </Box>
                </Box>

                <Alert severity="info" sx={{ mb: 2 }}>
                    {t('betaComments.intro', { defaultValue: 'We are actively developing the new website and your feedback makes a real difference. Tell us what works, what is broken, or what you would like to see.' })}
                </Alert>
                <Alert severity="success" icon={false} sx={{ mb: 3 }}>
                    💡 {t('betaComments.tipHint', { defaultValue: 'For the best feedback, use the "Send a tip" button found on trails and event pages — it automatically captures a screenshot of exactly what you are seeing.' })}
                </Alert>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <SendTipButton type="event" inline />
                </Paper>
            </Container>
        </Layout>
    );
}

import { Container, Typography, Paper } from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import type { PaletteMode } from '@mui/material';

interface NewsletterPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function NewsletterPage({ mode, onToggleMode }: NewsletterPageProps) {
    const { t } = useTranslation();
    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                    <EmailOutlinedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        {t('newsletter.title')}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        {t('newsletter.description')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('newsletter.comingSoon')}
                    </Typography>
                </Paper>
            </Container>
        </Layout>
    );
}

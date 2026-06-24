import { useState } from 'react';
import { Container, Typography, Paper, Button, Box } from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import type { PaletteMode } from '@mui/material';

// Split to avoid plain-text harvesting
const USER = 'oskar';
const DOMAIN = 'hlaupadagskra';
const TLD = 'is';

interface ContactPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

export default function ContactPage({ mode, onToggleMode }: ContactPageProps) {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);
    const email = `${USER}@${DOMAIN}.${TLD}`;

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                    <EmailOutlinedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        {t('contact.title')}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        {revealed ? t('contact.descriptionRevealed') : t('contact.description')}
                    </Typography>

                    {revealed ? (
                        <Box>
                            <Button
                                variant="contained"
                                href={`mailto:${email}`}
                                startIcon={<EmailOutlinedIcon />}
                            >
                                {email}
                            </Button>
                        </Box>
                    ) : (
                        <Button variant="outlined" onClick={() => setRevealed(true)}>
                            {t('contact.showEmail')}
                        </Button>
                    )}
                </Paper>
            </Container>
        </Layout>
    );
}

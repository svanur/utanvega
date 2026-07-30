import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Divider, Link as MuiLink } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import type { ReactNode } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PaceModelTable from '../components/PaceModelTable';

interface FaqPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

interface FaqItem {
    key: string;
    content?: ReactNode;
    footer?: ReactNode;
}

export default function FaqPage({ mode, onToggleMode }: FaqPageProps) {
    const { t } = useTranslation();

    const items: FaqItem[] = [
        { key: 'estimatedTime', content: <PaceModelTable /> },
        { key: 'difficulty' },
        { key: 'terrainType' },
        { key: 'relatedTrails' },
        {
            key: 'itraIndex',
            footer: (
                <MuiLink component={Link} to="/itra-guide" variant="body2">
                    {t('faq.itraIndex.link')}
                </MuiLink>
            ),
        },
        { key: 'gpsDistance' },
        { key: 'trailSuggestion' },
    ];

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Box sx={{ maxWidth: 760, mx: 'auto', px: 2, py: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <HelpOutlineIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h4" fontWeight="bold">
                        {t('faq.title')}
                    </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    {t('faq.subtitle')}
                </Typography>

                <Divider sx={{ mb: 3 }} />

                {items.map((item) => (
                    <Accordion key={item.key} disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 1, borderRadius: 1, '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography fontWeight={600}>
                                {t(`faq.${item.key}.q`)}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: (item.content || item.footer) ? 2 : 0 }}>
                                {t(`faq.${item.key}.a`)}
                            </Typography>
                            {item.content}
                            {item.footer}
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Box>
        </Layout>
    );
}

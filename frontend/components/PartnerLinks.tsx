import { Box, Card, CardContent, Link, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ExternalLink { label: string; href: string; }
interface InternalLink { labelKey: string; to: string; }

interface Partner {
    titleKey: string;
    links: ExternalLink[];
    internalLinks?: InternalLink[];
    descriptionKey?: string;
}

const PARTNERS: Partner[] = [
    {
        titleKey: 'partnerLinks.hlaupis.title',
        links: [{ label: 'hlaup.is', href: 'https://www.hlaup.is' }],
        descriptionKey: 'partnerLinks.hlaupis.description',
    },
    {
        titleKey: 'partnerLinks.timataka.title',
        links: [
            { label: 'netskraning.is', href: 'https://www.netskraning.is' },
            { label: 'timataka.is', href: 'https://www.timataka.is' },
        ],
        descriptionKey: 'partnerLinks.timataka.description',
    },
    {
        titleKey: 'partnerLinks.itra.title',
        links: [{ label: 'itra.run', href: 'https://itra.run/Races/RaceCalendar' }],
        internalLinks: [{ labelKey: 'partnerLinks.itra.guideLabel', to: '/itra' }],
        descriptionKey: 'partnerLinks.itra.description',
    },
    {
        titleKey: 'partnerLinks.tenglar.title',
        links: [
            { label: 'Hlauparar á Íslandi', href: 'https://www.facebook.com/groups/141974679232397' },
            { label: 'Miðaskipti', href: 'https://www.facebook.com/groups/1146319782540776/' },
            { label: 'FRÍ Vottað yfirlit', href: 'https://fri.is/hlaupamal/framkvaemd-gotuhlaupa/' },
        ],
    },
];

export default function PartnerLinks() {
    const { t } = useTranslation();

    return (
        <Box
            sx={{
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                px: { xs: 2, sm: 3 },
                py: 3,
            }}
        >
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                useFlexGap
                flexWrap="wrap"
                justifyContent="center"
            >
                {PARTNERS.map((partner) => (
                    <Card
                        key={partner.titleKey}
                        variant="outlined"
                        sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}
                    >
                        <CardContent sx={{ pb: '12px !important' }}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                {t(partner.titleKey)}
                            </Typography>
                            <Stack
                                direction={partner.descriptionKey ? 'row' : 'column'}
                                spacing={partner.descriptionKey ? 1 : 0.5}
                                flexWrap="wrap"
                                sx={{ mb: partner.descriptionKey ? 1 : 0 }}
                            >
                                {partner.links.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant="body2"
                                        underline="hover"
                                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                                    >
                                        {link.label}
                                        <OpenInNewIcon sx={{ fontSize: 12, opacity: 0.6 }} />
                                    </Link>
                                ))}
                            </Stack>
                            {partner.descriptionKey && (
                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                                    {t(partner.descriptionKey)}
                                </Typography>
                            )}
                            {partner.internalLinks && partner.internalLinks.map((link) => (
                                <Link
                                    key={link.to}
                                    component={RouterLink}
                                    to={link.to}
                                    variant="body2"
                                    underline="hover"
                                    sx={{ display: 'inline-block', mt: 0.5 }}
                                >
                                    {t(link.labelKey)}
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </Stack>
        </Box>
    );
}

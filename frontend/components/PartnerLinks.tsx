import { Box, Card, CardContent, Link, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface Partner {
    title: string;
    links: { label: string; href: string }[];
    description?: string;
}

const PARTNERS: Partner[] = [
    {
        title: 'Hlaup.is',
        links: [{ label: 'hlaup.is', href: 'https://www.hlaup.is' }],
        description: 'Miðstöð upplýsinga og fróðleiks fyrir alla þá sem stunda hlaup að einhverju marki.\n\nSkráningar, námskeið, úrslit og hlaupahópar, einkunnir hlaupa og fleira.',
    },
    {
        title: 'Netskraning.is | Timataka.is',
        links: [
            { label: 'netskraning.is', href: 'https://www.netskraning.is' },
            { label: 'timataka.is', href: 'https://www.timataka.is' },
        ],
        description: 'Tímataka sérhæfir sig í tímatöku með flögutímatökutækjum frá MyLaps.\n\nTimataka hefur séð um tímatöku í eftirfarandi greinum: götuhlaupi, víðavangshlaupi, skíðagöngu, hjólreiðum, sundi og hundasleðakeppni.',
    },
    {
        title: 'ITRA Race Calendar',
        links: [{ label: 'itra.run', href: 'https://itra.run/Races/RaceCalendar' }],
        description: 'Listi yfir öll hlaup sem hafa fengið staðfesta ITRA punkta. Hægt að leita eftir landi og tímabili.\n\nEinnig úrslit hlaupa.',
    },
    {
        title: 'Tenglar',
        links: [
            { label: 'Hlauparar á Íslandi', href: 'https://www.facebook.com/groups/141974679232397' },
            { label: 'Miðaskipti', href: 'https://www.facebook.com/groups/1146319782540776/' },
            { label: 'FRÍ Vottað yfirlit', href: 'https://fri.is/hlaupamal/framkvaemd-gotuhlaupa/' },
        ],
    },
];

export default function PartnerLinks() {
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
                        key={partner.title}
                        variant="outlined"
                        sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}
                    >
                        <CardContent sx={{ pb: '12px !important' }}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                {partner.title}
                            </Typography>
                            <Stack
                                direction={partner.description ? 'row' : 'column'}
                                spacing={partner.description ? 1 : 0.5}
                                flexWrap="wrap"
                                sx={{ mb: partner.description ? 1 : 0 }}
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
                            {partner.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                                    {partner.description}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </Stack>
        </Box>
    );
}

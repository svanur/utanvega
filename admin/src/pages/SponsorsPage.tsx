import {
    Alert,
    Box,
    Chip,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';

const SPONSOR_ADS = [
    {
        name: 'Garmin',
        flag: 'sponsor_garmin',
        image: '/sponsors/garmin.avif',
        href: 'https://garminbudin.is/',
        type: 'External',
        placement: 'SponsorStrip',
        notes: 'Small logo bar above content',
    },
    {
        name: 'Craft',
        flag: 'sponsor_craft',
        image: '/sponsors/craft.avif',
        href: 'https://craftverslun.is/',
        type: 'External',
        placement: 'SponsorStrip',
        notes: 'Small logo bar above content',
    },
    {
        name: 'Útivistaáskorun 2026',
        flag: 'promo_challenge_2026',
        image: '/sponsors/challenge-2026.avif',
        href: '/challenge/2026',
        type: 'Internal',
        placement: 'PromoStrip',
        notes: 'Text baked into image — update image file to change copy',
    },
    {
        name: 'Hlaupaferð í Svissnesku Alpana',
        flag: 'promo_running_trip_2026',
        image: '/sponsors/running-trip-2026.avif',
        href: '/shop/hlaupaferd',
        type: 'Internal',
        placement: 'PromoStrip',
        notes: 'Text overlay rendered from i18n — update promos.runningTrip.* keys',
    },
];

export default function SponsorsPage() {
    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <ImageOutlinedIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>Sponsors & Promotions</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Reference page for all ads and promotional banners on hlaupadagskra.is.
                Each ad is independently controlled by a feature flag in the Features admin page.
            </Typography>

            {/* Current ads table */}
            <Paper variant="outlined" sx={{ mb: 4 }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle1" fontWeight={700}>Current Ads</Typography>
                </Box>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                            <TableCell>Name</TableCell>
                            <TableCell>Feature Flag</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Placement</TableCell>
                            <TableCell>Image File</TableCell>
                            <TableCell>Notes</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {SPONSOR_ADS.map(ad => (
                            <TableRow key={ad.flag}>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>{ad.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">{ad.href}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        icon={<FlagOutlinedIcon />}
                                        label={ad.flag}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={ad.type}
                                        size="small"
                                        color={ad.type === 'Internal' ? 'primary' : 'default'}
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                        {ad.placement}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                        {ad.image}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" color="text.secondary">{ad.notes}</Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            <Divider sx={{ my: 4 }} />

            {/* How to add a new ad */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <MenuBookOutlinedIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>How to Add a New Ad</Typography>
            </Stack>

            <Stack spacing={2}>
                {/* Step 1 */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Chip label="1" size="small" color="primary" sx={{ fontWeight: 700, mt: 0.25, flexShrink: 0 }} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Add the image</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Save the image as <code>.avif</code> (preferred), <code>.png</code>, or <code>.jpg</code> into:
                            </Typography>
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                frontend/public/sponsors/your-sponsor-name.avif
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                For the SponsorStrip (logo bar): aim for ~36px tall. For PromoStrip cards: ~180px tall, wide aspect ratio works best.
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>

                {/* Step 2 */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Chip label="2" size="small" color="primary" sx={{ fontWeight: 700, mt: 0.25, flexShrink: 0 }} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Add a feature flag</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Go to <strong>Features</strong> in this admin and add a new flag. Use the naming convention:
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                                <Chip label="sponsor_name" size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>for external partners (logo strip)</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                <Chip label="promo_name_year" size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>for internal promotions (promo cards)</Typography>
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>

                {/* Step 3 */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Chip label="3" size="small" color="primary" sx={{ fontWeight: 700, mt: 0.25, flexShrink: 0 }} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Register the ad in the component</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Depending on placement, edit one of these files:
                            </Typography>
                            <Stack spacing={1}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">Logo bar (small external sponsors):</Typography>
                                    <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                        frontend/components/SponsorStrip.tsx → add entry to SPONSORS array
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">Promo cards (50/50 internal promos):</Typography>
                                    <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                        frontend/components/PromoStrip.tsx → add isEnabled check + JSX card
                                    </Box>
                                </Box>
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>

                {/* Step 4 — text overlay only */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Chip label="4" size="small" color="primary" sx={{ fontWeight: 700, mt: 0.25, flexShrink: 0 }} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                If the card has a text overlay — add i18n keys
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                Skip this step if the text is baked into the image. Otherwise add keys to both:
                            </Typography>
                            <Stack spacing={0.5}>
                                <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    frontend/i18n/en.json → promos.yourKey.title / .dates / .cta
                                </Box>
                                <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    frontend/i18n/is.json → same keys in Icelandic
                                </Box>
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>

                {/* Step 5 */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Chip label="5" size="small" color="primary" sx={{ fontWeight: 700, mt: 0.25, flexShrink: 0 }} />
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Update this page</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Add the new ad to the <code>SPONSOR_ADS</code> array at the top of{' '}
                                <code>admin/src/pages/SponsorsPage.tsx</code> so it appears in the table above.
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>
            </Stack>

            <Divider sx={{ my: 4 }} />

            {/* Layout reference */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <LinkOutlinedIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>Layout Order</Typography>
            </Stack>
            <Alert severity="info" sx={{ mb: 2 }}>
                The order of elements on every page is fixed in{' '}
                <code>frontend/components/Layout.tsx</code>.
            </Alert>
            <Paper variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                            <TableCell>#</TableCell>
                            <TableCell>Element</TableCell>
                            <TableCell>Feature Flag</TableCell>
                            <TableCell>Component</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {[
                            { order: 1, name: 'Announcement Banner', flag: 'announcement_banner', component: 'AnnouncementBanner' },
                            { order: 2, name: 'Sponsor Logo Strip', flag: 'sponsor_garmin / sponsor_craft', component: 'SponsorStrip' },
                            { order: 3, name: 'Hero Band', flag: 'hero_band', component: 'HeroBand' },
                            { order: 4, name: 'Promo Cards', flag: 'promo_challenge_2026 / promo_running_trip_2026', component: 'PromoStrip' },
                            { order: 5, name: 'Event Day Banner', flag: 'event_day_banner', component: 'EventDayBanner' },
                            { order: 6, name: 'Page Content', flag: '—', component: 'children' },
                        ].map(row => (
                            <TableRow key={row.order}>
                                <TableCell>{row.order}</TableCell>
                                <TableCell><Typography variant="body2" fontWeight={600}>{row.name}</Typography></TableCell>
                                <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{row.flag}</Typography></TableCell>
                                <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{row.component}</Typography></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
}

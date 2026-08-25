import { Chip, Container, Divider, Paper, Stack, Typography, type PaletteMode } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import { usePageTitle } from '../hooks/usePageTitle';

interface ChangelogDiaryPageProps {
    mode: PaletteMode;
    onToggleMode: () => void;
}

/**
 * Private development diary.
 *
 * Unlisted: no nav or footer link, excluded from the sitemap, disallowed in
 * robots.txt and served `noindex` to crawlers by api/og.ts.
 *
 * Entries come from `about.changelog` in the i18n files, which is already
 * written in both languages. That content used to render on the About page
 * before the milestone timeline replaced it, and has been unused since — this
 * page brings it back rather than duplicating it.
 */

/** Newest first. Keys must exist under `about.changelog`. */
const VERSIONS = [
    'v2_6', 'v2_5', 'v2_4', 'v2_3', 'v2_2', 'v2_1', 'v2_0', 'v1_9',
    'v1_8', 'v1_7', 'v1_6', 'v1_5', 'v1_4', 'v1_3', 'v1_2', 'v1_1', 'v1_0',
];

/**
 * Release dates, where known. Only the go-live and everything after it were
 * recorded; earlier versions predate the log and are shown without a date
 * rather than with an invented one. Add entries here as they are established.
 */
const RELEASE_DATES: Record<string, string> = {
    v2_6: '2026-08-25',
    v2_5: '2026-08-22',
};

/** Versions that shipped to production, as opposed to pre-launch development. */
const WENT_LIVE = 'v2_5';

function formatVersion(key: string) {
    return key.replace('_', '.');
}

function formatDate(iso: string, language: string) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(
        language === 'is' ? 'is-IS' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' },
    );
}

export default function ChangelogDiaryPage({ mode, onToggleMode }: ChangelogDiaryPageProps) {
    const { t, i18n } = useTranslation();
    usePageTitle('Changelog diary');

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: 'Changelog diary' }]}>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Stack spacing={1} sx={{ mb: 4 }}>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                        Changelog diary
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Full release history, in more detail than the milestone timeline on the
                        About page. Unlisted and not indexed.
                    </Typography>
                </Stack>

                <Stack spacing={2.5}>
                    {VERSIONS.map(key => {
                        const date = RELEASE_DATES[key];
                        const isLive = key === WENT_LIVE;
                        return (
                            <Paper key={key} elevation={2} sx={{ p: { xs: 2, sm: 3 } }}>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={1.5}
                                    flexWrap="wrap"
                                    useFlexGap
                                >
                                    <Chip
                                        label={formatVersion(key)}
                                        color="primary"
                                        size="small"
                                        sx={{ fontWeight: 700 }}
                                    />
                                    {date && (
                                        <Typography variant="body2" color="text.secondary">
                                            {formatDate(date, i18n.language)}
                                        </Typography>
                                    )}
                                    {isLive && (
                                        <Chip label="Live" color="success" size="small" variant="outlined" />
                                    )}
                                </Stack>

                                <Divider sx={{ my: 1.5 }} />

                                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                    {t(`about.changelog.${key}.title`)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t(`about.changelog.${key}.description`)}
                                </Typography>
                            </Paper>
                        );
                    })}
                </Stack>
            </Container>
        </Layout>
    );
}

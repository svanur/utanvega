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

/**
 * Newest first. Keys must exist under `about.changelog` in both locales, and
 * are the version number itself — `v1_1_0` renders as v1.1.0.
 *
 * Numbering follows the GitHub releases. Versions below 1.0.0 are retrospective
 * labels for work that predates tagged releases, so they are numbered in order
 * rather than matched to a tag; only 1.0.0 and later have a release to link to.
 */
const VERSIONS = [
    'v1_2_0', 'v1_1_1', 'v1_1_0', 'v1_0_0',
    'v0_15_0', 'v0_14_0', 'v0_13_0', 'v0_12_0', 'v0_11_0', 'v0_10_0', 'v0_9_0',
    'v0_8_0', 'v0_7_0', 'v0_6_0', 'v0_5_0', 'v0_4_0', 'v0_3_0', 'v0_2_0', 'v0_1_0',
    'v0_0_0',
];

/**
 * Release dates, where known. Only the go-live and later were recorded;
 * earlier entries are shown without a date rather than with an invented one.
 * Add entries here as they are established.
 */
const RELEASE_DATES: Record<string, string> = {
    v1_2_0: '2026-08-25',
    v1_1_1: '2026-08-25',
    v1_1_0: '2026-08-25',
    v1_0_0: '2026-08-22',
};

/**
 * Entries with a matching GitHub release, whose version chip links to it.
 * The pre-1.0.0 numbers are retrospective and have no release behind them, so
 * linking them would 404.
 */
const GITHUB_RELEASES = new Set(['v1_2_0', 'v1_1_1', 'v1_1_0', 'v1_0_0']);

const RELEASES_URL = 'https://github.com/svanur/utanvega/releases/tag';

/**
 * The original hlaupadagskra.is — a different site that shares only the name,
 * so it sits at 0.0.0 outside the sequence rather than as its first version.
 */
const PREDECESSOR_VERSION = 'v0_0_0';

/**
 * The release that went to production. A single marker on an ordered list, not
 * a category: everything above it shipped after launch, everything below it is
 * pre-launch development. Later releases get no badge of their own — one per
 * release would be noise, since post-launch is the normal case.
 */
const GO_LIVE_VERSION = 'v1_0_0';

function formatVersion(key: string) {
    // Every underscore, not just the first — keys are now v1_1_1, not just v2_6.
    return key.replace(/_/g, '.');
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
                        const isGoLive = key === GO_LIVE_VERSION;
                        const version = formatVersion(key);
                        const releaseUrl = GITHUB_RELEASES.has(key)
                            ? `${RELEASES_URL}/${version}`
                            : null;
                        const isPredecessor = key === PREDECESSOR_VERSION;
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
                                        label={version}
                                        color={isPredecessor ? 'default' : 'primary'}
                                        size="small"
                                        sx={{ fontWeight: 700 }}
                                        {...(releaseUrl
                                            ? {
                                                component: 'a',
                                                href: releaseUrl,
                                                target: '_blank',
                                                rel: 'noopener noreferrer',
                                                clickable: true,
                                            }
                                            : {})}
                                    />
                                    {date && (
                                        <Typography variant="body2" color="text.secondary">
                                            {formatDate(date, i18n.language)}
                                        </Typography>
                                    )}
                                    {isGoLive && (
                                        <Chip label="Went live" color="success" size="small" variant="outlined" />
                                    )}
                                    {isPredecessor && (
                                        <Chip label="Previous site" size="small" variant="outlined" />
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

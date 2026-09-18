import { useRef, useState, useLayoutEffect, useCallback } from 'react';
import type { PaletteMode } from '@mui/material';
import { Box, Typography, Divider, Stack, Paper, Button, IconButton, CircularProgress, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Layout from '../components/Layout';
import { usePageTitle } from '../hooks/usePageTitle';

// pdf.js needs its worker bundled separately from the main thread — Vite resolves this
// to a hashed asset URL at build time, same trick used for other worker-backed libs.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PDF_URL = '/documents/arsskyrsla-2025.pdf';
const PDF_DOWNLOAD_NAME = 'hlaupadagskra-arsskyrsla-2025.pdf';
const PDF_MAX_WIDTH = 760;

function StatCard({ value, label }: { value: string; label: string }) {
    return (
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color="primary">{value}</Typography>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Paper>
    );
}

function AnnualReportPdfViewer() {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [loadError, setLoadError] = useState(false);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;
            setContainerWidth(width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
        setNumPages(total);
        setLoadError(false);
    }, []);

    const handleLoadError = useCallback((error: Error) => {
        console.error('Annual report PDF failed to load', error);
        setLoadError(true);
    }, []);

    const pageWidth = Math.min(containerWidth, PDF_MAX_WIDTH) || undefined;

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                    {t('annualReport.fullReportTitle')}
                </Typography>
                <Tooltip title={t('annualReport.downloadPdf')} arrow>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadIcon fontSize="small" />}
                        component="a"
                        href={PDF_URL}
                        download={PDF_DOWNLOAD_NAME}
                        sx={{ minWidth: 44, minHeight: 44 }}
                    >
                        {t('annualReport.downloadPdf')}
                    </Button>
                </Tooltip>
            </Stack>

            <Box
                ref={containerRef}
                sx={{
                    width: '100%',
                    maxWidth: PDF_MAX_WIDTH,
                    mx: 'auto',
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
            >
                {loadError ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">{t('annualReport.pdfLoadError')}</Typography>
                    </Box>
                ) : (
                    <Document
                        file={PDF_URL}
                        onLoadSuccess={handleLoadSuccess}
                        onLoadError={handleLoadError}
                        loading={
                            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                                <CircularProgress size={28} />
                            </Box>
                        }
                    >
                        {containerWidth > 0 && (
                            <Page
                                pageNumber={pageNumber}
                                width={pageWidth}
                                loading={
                                    <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                                        <CircularProgress size={28} />
                                    </Box>
                                }
                            />
                        )}
                    </Document>
                )}
            </Box>

            {numPages && numPages > 0 && (
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={2} sx={{ mt: 2 }}>
                    <IconButton
                        onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        aria-label={t('annualReport.previousPage')}
                        sx={{ minWidth: 44, minHeight: 44 }}
                    >
                        <NavigateBeforeIcon />
                    </IconButton>
                    <Typography variant="body2" color="text.secondary">
                        {t('annualReport.pageOf', { current: pageNumber, total: numPages })}
                    </Typography>
                    <IconButton
                        onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        aria-label={t('annualReport.nextPage')}
                        sx={{ minWidth: 44, minHeight: 44 }}
                    >
                        <NavigateNextIcon />
                    </IconButton>
                </Stack>
            )}
        </Box>
    );
}

export default function AnnualReportPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    usePageTitle(t('annualReport.title'));
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.annualReport') }]}>
            <Box sx={{ py: 2 }}>
                <Typography variant="overline" color="text.secondary">hlaupadagskra.is</Typography>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t('annualReport.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    {t('annualReport.intro')}
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
                    <StatCard value="141" label={t('annualReport.stat.events')} />
                    <StatCard value=">45.000" label={t('annualReport.stat.registrations')} />
                    <StatCard value="+25%" label={t('annualReport.stat.growth')} />
                    <StatCard value="64" label={t('annualReport.stat.nationalities')} />
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('annualReport.topEventsTitle')}
                </Typography>
                <Stack spacing={1} sx={{ mb: 4 }}>
                    {[
                        { name: 'Reykjavík Marathon', count: '16.119', change: '+22%' },
                        { name: 'Midnight Sun Run', count: '2.347', change: '+11%' },
                        { name: 'New Year\'s Run (ÍR)', count: '1.777', change: '+18%' },
                        { name: 'The Puffin Run', count: '1.334', change: '+20%' },
                        { name: 'Hengill Ultra Trail', count: '1.085', change: '-15%' },
                    ].map((ev) => (
                        <Stack key={ev.name} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2">{ev.name}</Typography>
                            <Stack direction="row" spacing={2}>
                                <Typography variant="body2" fontWeight={600}>{ev.count}</Typography>
                                <Typography variant="body2" color={ev.change.startsWith('+') ? 'success.main' : 'error.main'}>{ev.change}</Typography>
                            </Stack>
                        </Stack>
                    ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('annualReport.highlightsTitle')}
                </Typography>
                <Stack spacing={1.5} sx={{ mb: 4 }}>
                    {[1, 2, 3, 4].map((n) => (
                        <Stack key={n} direction="row" spacing={1.5} alignItems="flex-start">
                            <Typography color="primary" fontWeight={700}>•</Typography>
                            <Typography variant="body1">{t(`annualReport.highlight${n}`)}</Typography>
                        </Stack>
                    ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('annualReport.genderTitle')}
                </Typography>
                <Stack spacing={0.5} sx={{ mb: 4 }}>
                    <Typography variant="body2">👨 {t('annualReport.male')}: 51,1%</Typography>
                    <Typography variant="body2">👩 {t('annualReport.female')}: 48,8%</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('annualReport.genderNote')}</Typography>
                </Stack>

                <Typography variant="caption" color="text.secondary">
                    {t('annualReport.source')}: timataka.is, corsa.is
                </Typography>

                <Divider sx={{ my: 3 }} />

                <AnnualReportPdfViewer />
            </Box>
        </Layout>
    );
}

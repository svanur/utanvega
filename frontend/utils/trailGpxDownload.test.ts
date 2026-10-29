import { describe, it, expect, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { downloadTrailGpx } from './trailGpxDownload';

// t() isn't exercised beyond the 'trail.gpxDownloadFailed' key in this module, so a stub that
// echoes the key back (rather than the real i18next instance) is enough to assert on.
const t = ((key: string) => key) as TFunction;

function baseOptions(overrides: Partial<Parameters<typeof downloadTrailGpx>[0]> = {}) {
    return {
        fetchImpl: vi.fn(),
        apiUrl: 'https://api.example.com',
        slug: 'esjan-hringur',
        language: 'is',
        t,
        setToastSeverity: vi.fn(),
        setToastMessage: vi.fn(),
        trackTrailGpxDownload: vi.fn(),
        ...overrides,
    };
}

describe('downloadTrailGpx (#1559)', () => {
    it('fetches the blob, triggers a download, and tracks analytics on success', async () => {
        const blob = new Blob(['gpx-contents']);
        const response = { ok: true, blob: vi.fn().mockResolvedValue(blob) } as unknown as Response;
        const fetchImpl = vi.fn().mockResolvedValue(response);
        const createObjectUrl = vi.fn().mockReturnValue('blob:object-url');
        const triggerDownload = vi.fn();
        const options = baseOptions({ fetchImpl, createObjectUrl, triggerDownload });

        await downloadTrailGpx(options);

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://api.example.com/api/v1/trails/esjan-hringur/gpx',
        );
        expect(createObjectUrl).toHaveBeenCalledWith(blob);
        expect(triggerDownload).toHaveBeenCalledWith('blob:object-url', 'esjan-hringur.gpx');
        expect(options.trackTrailGpxDownload).toHaveBeenCalledWith('esjan-hringur');
        expect(options.setToastSeverity).not.toHaveBeenCalled();
        expect(options.setToastMessage).not.toHaveBeenCalled();
    });

    it('appends ?lang=en to the request URL when language is en', async () => {
        const response = { ok: true, blob: vi.fn().mockResolvedValue(new Blob()) } as unknown as Response;
        const fetchImpl = vi.fn().mockResolvedValue(response);
        const options = baseOptions({
            fetchImpl,
            language: 'en',
            createObjectUrl: vi.fn().mockReturnValue('blob:object-url'),
            triggerDownload: vi.fn(),
        });

        await downloadTrailGpx(options);

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://api.example.com/api/v1/trails/esjan-hringur/gpx?lang=en',
        );
    });

    it('shows the error toast and does not download on a non-ok response', async () => {
        const response = { ok: false } as unknown as Response;
        const fetchImpl = vi.fn().mockResolvedValue(response);
        const createObjectUrl = vi.fn();
        const options = baseOptions({ fetchImpl, createObjectUrl });

        await downloadTrailGpx(options);

        expect(options.setToastSeverity).toHaveBeenCalledWith('error');
        expect(options.setToastMessage).toHaveBeenCalledWith('trail.gpxDownloadFailed');
        expect(createObjectUrl).not.toHaveBeenCalled();
        expect(options.trackTrailGpxDownload).not.toHaveBeenCalled();
    });

    it('shows the error toast when fetch throws', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
        const createObjectUrl = vi.fn();
        const options = baseOptions({ fetchImpl, createObjectUrl });

        await downloadTrailGpx(options);

        expect(options.setToastSeverity).toHaveBeenCalledWith('error');
        expect(options.setToastMessage).toHaveBeenCalledWith('trail.gpxDownloadFailed');
        expect(createObjectUrl).not.toHaveBeenCalled();
        expect(options.trackTrailGpxDownload).not.toHaveBeenCalled();
    });
});

// @vitest-environment jsdom
//
// #1645: backfills test coverage for NewsletterPage.tsx's status-state machine (idle/sending/
// subscribed/error, NewsletterPage.tsx:22) and its client-side EMAIL_PATTERN pre-check
// (NewsletterPage.tsx:20,31-36), which had zero automated coverage since #1643/#1641 added the
// page. Follows RacesPage.test.tsx's jsdom-opt-in + RTL + real-i18next-instance pattern, since
// vitest.config.ts defaults to `environment: 'node'`.
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';

// vitest.config.ts doesn't set `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) registration never fires — without this, a later test's screen queries can
// match leftover DOM nodes still mounted from an earlier test in this file. Mirrors
// RacesPage.test.tsx:24.
afterEach(cleanup);

// NewsletterPage's t() calls need a real, initialized i18next instance (react-i18next's
// useTranslation() otherwise falls back to raw keys, e.g. `t('newsletter.emailInvalid')` would
// render the key string itself rather than "Enter a valid email address.") — initialized once
// with the real EN resources, mirroring RacesPage.test.tsx:31-36.
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// RacesPage.test.tsx's #1235 precedent mocks out Layout: it pulls in useMediaQuery (jsdom has no
// window.matchMedia implementation, so a real Layout render throws) plus a dozen data-fetching
// hooks that have nothing to do with the form-state logic this file targets. Mocked to a bare
// passthrough so NewsletterPage's own content — the thing under test — still renders.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import NewsletterPage from './NewsletterPage';

function renderNewsletterPage() {
    return render(<NewsletterPage mode="light" onToggleMode={() => {}} />);
}

function getEmailInput(): HTMLInputElement {
    return screen.getByLabelText(en.newsletter.emailLabel) as HTMLInputElement;
}

function getSubscribeButton(): HTMLElement {
    return screen.getByRole('button', { name: en.newsletter.subscribe });
}

// Clicking a type="submit" button inside a <form> whose <input type="email"> value fails jsdom's
// native HTML5 email constraint validation (e.g. no "@" at all) never fires the form's onSubmit —
// the browser's own submission algorithm blocks it before React's handler runs, same as in a real
// browser. Dispatching "submit" directly on the <form> bypasses that constraint-validation step.
// This matters here because EMAIL_PATTERN (NewsletterPage.tsx:20,31-36) is *stricter* than the
// browser's own type="email" check — e.g. "test@localhost" passes native validation (just needs
// an "@") but fails EMAIL_PATTERN (needs a "." after it) — so fireEvent.submit is the only
// reliable way to reach the EMAIL_PATTERN branch from a test.
function submitForm() {
    const form = getSubscribeButton().closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
}

describe('NewsletterPage form states (#1645)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows the inline email-invalid error and makes no fetch call for an invalid address', async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        renderNewsletterPage();

        fireEvent.change(getEmailInput(), { target: { value: 'test@localhost' } });
        submitForm();

        expect(await screen.findByText(en.newsletter.emailInvalid)).not.toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('shows the success message and hides the form when the API call resolves ok', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchSpy);
        renderNewsletterPage();

        fireEvent.change(getEmailInput(), { target: { value: 'runner@example.com' } });
        submitForm();

        expect(await screen.findByText(en.newsletter.success)).not.toBeNull();
        expect(screen.queryByLabelText(en.newsletter.emailLabel)).toBeNull();
        expect(screen.queryByRole('button', { name: en.newsletter.subscribe })).toBeNull();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('shows the error message and keeps the form visible when the API call resolves not-ok', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({ ok: false });
        vi.stubGlobal('fetch', fetchSpy);
        renderNewsletterPage();

        fireEvent.change(getEmailInput(), { target: { value: 'runner@example.com' } });
        submitForm();

        expect(await screen.findByText(en.newsletter.error)).not.toBeNull();
        // The form (email field + submit button) stays mounted and interactable, unlike the
        // success path above — the user can correct the address and retry.
        expect(getEmailInput()).not.toBeNull();
        const button = getSubscribeButton();
        expect(button).not.toBeNull();
        expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows the error message when the API call rejects outright (network failure)', async () => {
        const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'));
        vi.stubGlobal('fetch', fetchSpy);
        renderNewsletterPage();

        fireEvent.change(getEmailInput(), { target: { value: 'runner@example.com' } });
        submitForm();

        await waitFor(() => expect(screen.getByText(en.newsletter.error)).not.toBeNull());
        expect(getEmailInput()).not.toBeNull();
    });
});

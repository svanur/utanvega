// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import SendTipButton from './SendTipButton';

// Mirrors EventTrailLegend.test.tsx's setup — real i18next so t(...) interpolates for real.
afterEach(cleanup);
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

const PLACEHOLDER = 'Suggest a correction, additional information, or other feedback...';
const SENT_MESSAGE = 'Thank you! Your tip has been sent.';
// MUI's Tooltip clones the Button and overwrites its accessible name with the
// tooltip title — the toggle button's accessible name is tip.tooltip, not tip.button.
const TOGGLE_BUTTON_NAME = 'Suggest a correction, additional info, or other feedback';

// The close "x" is an icon-only IconButton with no aria-label, so it has no accessible
// name to query by — find it via its CloseIcon child instead.
function closeButton(): HTMLElement {
    const icon = document.querySelector('[data-testid="CloseIcon"]');
    if (!icon) throw new Error('CloseIcon not found');
    return icon.closest('button') as HTMLElement;
}

// #1924: handleClose() used to hard-code setOpen(false), so the inline call site
// (SendCommentsPage) lost its form permanently after one successful send — nothing
// else can set `open` back to true without `inline`'s toggle button, which never renders.
describe('SendTipButton (#1924)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });

    it('inline: closing the post-send success state reopens the form immediately, empty and idle', async () => {
        render(<SendTipButton type="event" inline />);

        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'first comment' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton());

        // Form must still be visible (not collapsed) — just reset to a fresh, empty state.
        const reopenedInput = await screen.findByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
        expect(reopenedInput.value).toBe('');
    });

    it('inline: a second comment can be composed and sent right after the first, no reload', async () => {
        render(<SendTipButton type="event" inline />);

        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'first comment' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton()); // close "x" reopens the inline form

        const input = await screen.findByPlaceholderText(PLACEHOLDER);
        fireEvent.change(input, { target: { value: 'second comment' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('non-inline: closing the post-send success state resets state and collapses; the toggle button reopens it', async () => {
        render(<SendTipButton type="event" />);

        fireEvent.click(screen.getByRole('button', { name: TOGGLE_BUTTON_NAME }));
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'a tip' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton());

        // Collapsed: status/mode reset, so the "sent" branch is gone — unlike the inline case,
        // nothing but the toggle button can bring the form back (it is not auto-visible again).
        expect(screen.queryByText(SENT_MESSAGE)).toBeNull();

        // Toggle button still reopens it, and a fresh submission still works — proving `open`
        // actually flipped back to true rather than the form having been left permanently stuck.
        fireEvent.click(screen.getByRole('button', { name: TOGGLE_BUTTON_NAME }));
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'a second tip' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});

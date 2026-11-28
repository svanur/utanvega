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

// #1928: handleClose() used to hard-reset mode to 'simple' and clear name/email on every
// close, so a detailed-mode report lost its detailed fields (and dropped back to simple) the
// moment it reopened after a send. Mode and category/name/email should now survive a
// close+reopen; only message/stepsToReproduce/screenshot state should still reset.
describe('SendTipButton (#1928)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });

    const CATEGORY_LABEL = 'Category';
    const NAME_LABEL = 'Your name (optional)';
    const EMAIL_LABEL = 'Your email (optional)';
    const STEPS_LABEL = 'Steps to reproduce';
    const MODE_SIMPLE_NAME = 'Quick tip';
    const MODE_DETAILED_NAME = 'Detailed report';

    it('inline: detailed mode persists across a send+close+reopen', async () => {
        render(<SendTipButton type="event" inline />);

        // inline starts in detailed mode already; send once to reach the "sent" state.
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'first comment' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton());

        await screen.findByPlaceholderText(PLACEHOLDER);
        // MUI duplicates the InputLabel text into the OutlinedInput's notch legend, so
        // "Category" is never a unique text node — assert presence via getAllByText instead.
        expect(screen.getAllByText(CATEGORY_LABEL).length).toBeGreaterThan(0);
        expect(screen.getByLabelText(STEPS_LABEL)).not.toBeNull();
    });

    it('inline: simple mode persists across a send+close+reopen (no regression)', async () => {
        render(<SendTipButton type="event" inline />);

        // Switch to simple first, since inline starts in detailed.
        fireEvent.click(screen.getByRole('button', { name: MODE_SIMPLE_NAME }));
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'first comment' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton());

        await screen.findByPlaceholderText(PLACEHOLDER);
        expect(screen.queryAllByText(CATEGORY_LABEL).length).toBe(0);
        expect(screen.queryByLabelText(STEPS_LABEL)).toBeNull();
    });

    it('non-inline: detailed mode persists across a send+close+reopen', async () => {
        render(<SendTipButton type="event" />);

        fireEvent.click(screen.getByRole('button', { name: TOGGLE_BUTTON_NAME }));
        fireEvent.click(screen.getByRole('button', { name: MODE_DETAILED_NAME }));
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'a tip' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton());
        expect(screen.queryByText(SENT_MESSAGE)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: TOGGLE_BUTTON_NAME }));

        await screen.findByPlaceholderText(PLACEHOLDER);
        // MUI duplicates the InputLabel text into the OutlinedInput's notch legend, so
        // "Category" is never a unique text node — assert presence via getAllByText instead.
        expect(screen.getAllByText(CATEGORY_LABEL).length).toBeGreaterThan(0);
        expect(screen.getByLabelText(STEPS_LABEL)).not.toBeNull();
    });

    it('non-inline: simple mode persists across a send+close+reopen (no regression)', async () => {
        render(<SendTipButton type="event" />);

        fireEvent.click(screen.getByRole('button', { name: TOGGLE_BUTTON_NAME }));
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'a tip' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton());
        fireEvent.click(screen.getByRole('button', { name: TOGGLE_BUTTON_NAME }));

        await screen.findByPlaceholderText(PLACEHOLDER);
        expect(screen.queryAllByText(CATEGORY_LABEL).length).toBe(0);
        expect(screen.queryByLabelText(STEPS_LABEL)).toBeNull();
    });

    it('detailed send+close+reopen: category/name/email persist, steps/message/screenshot reset', async () => {
        render(<SendTipButton type="event" inline />);

        // MUI Select: open via mousedown on the combobox, pick the option from the listbox.
        // #1930: InputLabel/Select now carry a matching id/labelId, so the combobox has its
        // own accessible name — query by it rather than relying on "only one combobox".
        fireEvent.mouseDown(screen.getByRole('combobox', { name: CATEGORY_LABEL }));
        fireEvent.click(screen.getByRole('option', { name: 'Suggestion' }));

        const nameInput = screen.getByLabelText(NAME_LABEL) as HTMLInputElement;
        const emailInput = screen.getByLabelText(EMAIL_LABEL) as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'Jón' } });
        fireEvent.change(emailInput, { target: { value: 'jon@example.com' } });
        fireEvent.change(screen.getByLabelText(STEPS_LABEL), { target: { value: 'clicked the button' } });
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'a detailed tip' } });

        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(screen.getByText(SENT_MESSAGE)).not.toBeNull());

        fireEvent.click(closeButton());

        const reopenedName = await screen.findByLabelText(NAME_LABEL) as HTMLInputElement;
        const reopenedEmail = screen.getByLabelText(EMAIL_LABEL) as HTMLInputElement;
        const reopenedMessage = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
        const reopenedSteps = screen.getByLabelText(STEPS_LABEL) as HTMLInputElement;

        expect(screen.getByRole('combobox', { name: CATEGORY_LABEL }).textContent).toContain('Suggestion');
        expect(reopenedName.value).toBe('Jón');
        expect(reopenedEmail.value).toBe('jon@example.com');
        expect(reopenedMessage.value).toBe('');
        expect(reopenedSteps.value).toBe('');
        // Screenshot state resets too: no preview image survives the close.
        expect(screen.queryByAltText('Page screenshot')).toBeNull();
    });
});

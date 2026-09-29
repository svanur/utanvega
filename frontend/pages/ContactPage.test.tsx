import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

// #1047: the reveal-gated email (ContactPage.tsx:46-60) sits behind `useState(false)`
// (ContactPage.tsx:29) — renderToStaticMarkup never runs effects or event handlers (see
// ElevationCurveBackground.test.tsx for the sibling precedent of testing a .tsx file this way,
// without a DOM-testing library), so a real click can never be simulated here and the revealed
// branch would never show up in the markup under test. Forcing useState to always return
// `[true, ...]` is safe *only* because every other component left in ContactPage's render tree
// below is state-free: real MUI Container/Typography/Paper/Box have no internal useState (only
// Button's ButtonBase does, via its focusVisible/mountedState — that's the one component swapped
// out below), Layout is mocked away entirely, and react-i18next's useTranslation is replaced with
// a plain passthrough. If ContactPage ever grows a second stateful child, this mock will need
// revisiting.
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return { ...actual, useState: () => [true, vi.fn()] };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@mui/material', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@mui/material')>();
    return {
        ...actual,
        Button: ({ children, href }: { children?: ReactNode; href?: string }) =>
            href ? <a href={href}>{children}</a> : <button type="button">{children}</button>,
    };
});

import ContactPage from './ContactPage';

function renderWithHostname(hostname: string): string {
    vi.stubGlobal('window', { location: { hostname } });
    return renderToStaticMarkup(<ContactPage mode="light" onToggleMode={() => {}} />);
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ContactPage host-branching email (#1047)', () => {
    it.each(['localhost', 'hlaupadagskra.is', 'www.hlaupadagskra.is'])(
        'reveals oskar@hlaupadagskra.is on %s',
        (hostname) => {
            const markup = renderWithHostname(hostname);
            expect(markup).toContain('oskar@hlaupadagskra.is');
            expect(markup).not.toContain('oskar@360runs.com');
        }
    );

    it.each(['360runs.com', 'www.360runs.com'])(
        'reveals oskar@360runs.com on %s',
        (hostname) => {
            const markup = renderWithHostname(hostname);
            expect(markup).toContain('oskar@360runs.com');
            expect(markup).not.toContain('oskar@hlaupadagskra.is');
        }
    );

    // Lookalike hosts: superficially contain "360runs.com" but are not a true (sub)domain of it,
    // so matchesHostSuffix's anchoring must reject them and fall back to the Icelandic address —
    // same edge cases as frontend/api/_site.test.ts.
    it.each(['evil360runs.com', '360runs.com.evil.net'])(
        'falls back to oskar@hlaupadagskra.is on lookalike host %s',
        (hostname) => {
            const markup = renderWithHostname(hostname);
            expect(markup).toContain('oskar@hlaupadagskra.is');
            expect(markup).not.toContain('oskar@360runs.com');
        }
    );
});

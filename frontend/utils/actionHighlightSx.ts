import type { SystemStyleObject, Theme } from '@mui/system';

/**
 * Shared faint highlight for icon-only action buttons (share, QR, GPX,
 * compare, predictor, offline, directions) and their legend rows on
 * TrailDetailsPage: hover for mouse, active for the tap-and-hold moment on
 * touch devices (which have no :hover), focus-visible for keyboard nav. A
 * transparent border at rest keeps the swap to a visible one from shifting
 * layout. Theme tokens only (action.hover, divider) — no hardcoded colors,
 * so it stays correct in dark mode (#1851, #1853 review rounds).
 */
export const actionHighlightSx: SystemStyleObject<Theme> = {
    border: '1px solid transparent',
    '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
    '&:active': { bgcolor: 'action.hover', borderColor: 'divider' },
    '&:focus-visible': { bgcolor: 'action.hover', borderColor: 'divider' },
};

/**
 * The same highlight, applied unconditionally rather than via a pseudo-class
 * — for cross-highlighting an action's icon button from its legend row (or
 * vice versa) when the *other* element is hovered/focused, which plain CSS
 * can't express across two unrelated DOM subtrees. Spread after
 * `actionHighlightSx` so it wins when forced on.
 */
export const actionHighlightForcedSx: SystemStyleObject<Theme> = {
    bgcolor: 'action.hover',
    borderColor: 'divider',
};

import type { SxProps, Theme } from '@mui/material';

/**
 * Shared faint highlight for icon-only action buttons (share, QR, GPX,
 * compare, predictor, offline, directions) and their legend rows on
 * TrailDetailsPage: hover for mouse, active for the tap-and-hold moment on
 * touch devices (which have no :hover), focus-visible for keyboard nav. A
 * transparent border at rest keeps the swap to a visible one from shifting
 * layout. Theme tokens only (action.hover, divider) — no hardcoded colors,
 * so it stays correct in dark mode (#1851, #1853 review rounds).
 */
export const actionHighlightSx: SxProps<Theme> = {
    border: '1px solid transparent',
    '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
    '&:active': { bgcolor: 'action.hover', borderColor: 'divider' },
    '&:focus-visible': { bgcolor: 'action.hover', borderColor: 'divider' },
};

import { GlobalStyles } from '@mui/material';
import type { Theme } from '@mui/material/styles';

// #1781: Leaflet's bundled stylesheet (leaflet/dist/leaflet.css) hardcodes `.leaflet-tooltip` to
// a white background/border and dark text, plus matching white arrow-border colors on the four
// directional `:before` variants (`.leaflet-tooltip-top/-bottom/-left/-right`) — fine against a
// light page but an unreadable white box once the app switches to dark mode. This overrides those
// rules with theme palette colors instead, shared so LocationsPage, EventMapView, and TrailMapView
// (the three places rendering a Leaflet `<Tooltip>` on a boundary shape) stay in sync with the
// active theme via one mechanism rather than three separate copies of the same CSS.
export function LeafletTooltipThemeStyles({ theme }: { theme: Theme }) {
    return (
        <GlobalStyles
            styles={{
                '.leaflet-tooltip': {
                    backgroundColor: theme.palette.background.paper,
                    borderColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                },
                '.leaflet-tooltip-top:before': {
                    borderTopColor: theme.palette.background.paper,
                },
                '.leaflet-tooltip-bottom:before': {
                    borderBottomColor: theme.palette.background.paper,
                },
                '.leaflet-tooltip-left:before': {
                    borderLeftColor: theme.palette.background.paper,
                },
                '.leaflet-tooltip-right:before': {
                    borderRightColor: theme.palette.background.paper,
                },
            }}
        />
    );
}

// #1785: same root cause as #1781 above, for Leaflet's `<Popup>` instead of `<Tooltip>`. Leaflet's
// bundled stylesheet hardcodes `.leaflet-popup-content-wrapper`/`.leaflet-popup-tip` to a white
// background and `#333` text, and the close button to `#757575` (hover/focus `#585858`) — all fine
// against a light page but unreadable (or a jarring white box) once the app switches to dark mode.
// This overrides those rules with theme palette colors, shared so EventMapView and TrailMapView
// (the two places rendering a Leaflet `<Popup>`) stay in sync with the active theme via one
// mechanism rather than two separate copies of the same CSS.
export function LeafletPopupThemeStyles({ theme }: { theme: Theme }) {
    return (
        <GlobalStyles
            styles={{
                '.leaflet-popup-content-wrapper, .leaflet-popup-tip': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                },
                '.leaflet-container a.leaflet-popup-close-button': {
                    color: theme.palette.text.secondary,
                },
                '.leaflet-container a.leaflet-popup-close-button:hover, .leaflet-container a.leaflet-popup-close-button:focus': {
                    color: theme.palette.text.primary,
                },
            }}
        />
    );
}

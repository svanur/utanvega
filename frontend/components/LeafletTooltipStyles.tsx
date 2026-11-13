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

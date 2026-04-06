/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '@changey/react-leaflet-markercluster' {
    import { FC, PropsWithChildren } from 'react';
    interface MarkerClusterGroupProps {
        chunkedLoading?: boolean;
        maxClusterRadius?: number;
        spiderfyOnMaxZoom?: boolean;
        showCoverageOnHover?: boolean;
        [key: string]: unknown;
    }
    const MarkerClusterGroup: FC<PropsWithChildren<MarkerClusterGroupProps>>;
    export default MarkerClusterGroup;
}

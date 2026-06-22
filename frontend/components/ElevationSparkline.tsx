interface ElevationSparklineProps {
    profile: number[];
    width?: number | string;
    height?: number;
}

const VIEWBOX_W = 500;

export default function ElevationSparkline({ profile, width = VIEWBOX_W, height = 24 }: ElevationSparklineProps) {
    if (profile.length < 2) return null;

    const min = Math.min(...profile);
    const max = Math.max(...profile);
    const range = max - min || 1;

    const pad = 2;
    const innerW = VIEWBOX_W - pad * 2;
    const innerH = height - pad * 2;

    const pts = profile.map((v, i) => ({
        x: pad + (i / (profile.length - 1)) * innerW,
        y: height - pad - ((v - min) / range) * innerH,
    }));

    const linePts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const baseY = (height - pad).toFixed(1);
    const fillD = [
        `M${pts[0].x.toFixed(1)},${baseY}`,
        ...pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
        `L${pts[pts.length - 1].x.toFixed(1)},${baseY}`,
        'Z',
    ].join(' ');

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${VIEWBOX_W} ${height}`}
            preserveAspectRatio="none"
            style={{ display: 'block' }}
            aria-hidden
        >
            <defs>
                <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
                </linearGradient>
            </defs>
            <path d={fillD} fill="url(#elev-fill)" />
            <polyline
                points={linePts}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

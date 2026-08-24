// Shared canvas utilities for race share/finish cards

export type ActivityTheme = {
    bgFrom: string;
    bgTo: string;
    accent: string;
    textColor: string;
    subtextColor: string;
    mountainColor: string;
    badgeBg: string;
    badgeBorder: string;
};

export function getActivityTheme(activityType: string | undefined, isDark: boolean): ActivityTheme {
    switch (activityType) {
        case 'TrailRunning':
            return isDark
                ? { bgFrom: '#071a07', bgTo: '#152815', accent: '#f59e0b', textColor: '#f0fdf4', subtextColor: '#86efac', mountainColor: '#14532d', badgeBg: 'rgba(245,158,11,0.15)', badgeBorder: '#f59e0b' }
                : { bgFrom: '#f0fdf4', bgTo: '#fefce8', accent: '#15803d', textColor: '#14532d', subtextColor: '#4d7c0f', mountainColor: '#166534', badgeBg: 'rgba(21,128,61,0.1)', badgeBorder: '#15803d' };
        case 'Running':
            return isDark
                ? { bgFrom: '#0f172a', bgTo: '#1e293b', accent: '#60a5fa', textColor: '#f8fafc', subtextColor: '#94a3b8', mountainColor: '#1e3a5f', badgeBg: 'rgba(96,165,250,0.15)', badgeBorder: '#60a5fa' }
                : { bgFrom: '#f8fafc', bgTo: '#eff6ff', accent: '#1d4ed8', textColor: '#0f172a', subtextColor: '#475569', mountainColor: '#bfdbfe', badgeBg: 'rgba(29,78,216,0.08)', badgeBorder: '#1d4ed8' };
        case 'Hiking':
            return isDark
                ? { bgFrom: '#1c1007', bgTo: '#2d1f0a', accent: '#fb923c', textColor: '#fef9f0', subtextColor: '#fdba74', mountainColor: '#431407', badgeBg: 'rgba(251,146,60,0.15)', badgeBorder: '#fb923c' }
                : { bgFrom: '#fef9f0', bgTo: '#fef3c7', accent: '#c2410c', textColor: '#431407', subtextColor: '#7c2d12', mountainColor: '#fed7aa', badgeBg: 'rgba(194,65,12,0.1)', badgeBorder: '#c2410c' };
        case 'Cycling':
            return isDark
                ? { bgFrom: '#0f0f23', bgTo: '#1e1b4b', accent: '#eab308', textColor: '#faf5ff', subtextColor: '#a78bfa', mountainColor: '#312e81', badgeBg: 'rgba(234,179,8,0.15)', badgeBorder: '#eab308' }
                : { bgFrom: '#f5f3ff', bgTo: '#ede9fe', accent: '#7c3aed', textColor: '#1e1b4b', subtextColor: '#5b21b6', mountainColor: '#ddd6fe', badgeBg: 'rgba(124,58,237,0.1)', badgeBorder: '#7c3aed' };
        default:
            return isDark
                ? { bgFrom: '#1a1a2e', bgTo: '#2d1b4e', accent: '#f9a825', textColor: '#ffffff', subtextColor: '#b0bec5', mountainColor: '#3d2b5e', badgeBg: 'rgba(249,168,37,0.15)', badgeBorder: '#f9a825' }
                : { bgFrom: '#fff8e1', bgTo: '#fff3e0', accent: '#e65100', textColor: '#1a1a1a', subtextColor: '#546e7a', mountainColor: '#ffe0b2', badgeBg: 'rgba(230,81,0,0.1)', badgeBorder: '#e65100' };
    }
}

export function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [text];
}

/** Concentric running track lane arcs — viewed from ground level, fanning upward */
export function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';

    // Center point at bottom edge — arcs fan upward from here
    const cx = w / 2;
    const cy = h;

    const lanes = [
        { rx: w * 0.18, ry: h * 0.20, alpha: 0.32, lw: 12 },
        { rx: w * 0.30, ry: h * 0.29, alpha: 0.27, lw: 10 },
        { rx: w * 0.43, ry: h * 0.38, alpha: 0.22, lw: 9  },
        { rx: w * 0.56, ry: h * 0.47, alpha: 0.17, lw: 8  },
        { rx: w * 0.70, ry: h * 0.56, alpha: 0.13, lw: 7  },
        { rx: w * 0.85, ry: h * 0.65, alpha: 0.09, lw: 6  },
    ];

    for (const lane of lanes) {
        ctx.globalAlpha = lane.alpha;
        ctx.lineWidth = lane.lw;
        ctx.beginPath();
        // clockwise from π (left) to 0 (right) draws the upper arc
        ctx.ellipse(cx, cy, lane.rx, lane.ry, 0, Math.PI, 0, false);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

/** Dispatch to the right background based on activity type */
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, activityType: string | undefined) {
    if (activityType === 'Running') {
        drawRoad(ctx, w, h, color);
    } else {
        drawMountains(ctx, w, h, color);
    }
}

/** Two-layer mountain silhouette — back range then front range */
export function drawMountains(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
    ctx.fillStyle = color;

    // Back range — tall jagged peaks
    ctx.globalAlpha = 0.10;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.63);
    ctx.lineTo(w * 0.06, h * 0.55);
    ctx.lineTo(w * 0.14, h * 0.61);
    ctx.lineTo(w * 0.24, h * 0.40);
    ctx.lineTo(w * 0.34, h * 0.57);
    ctx.lineTo(w * 0.46, h * 0.36);
    ctx.lineTo(w * 0.57, h * 0.53);
    ctx.lineTo(w * 0.67, h * 0.43);
    ctx.lineTo(w * 0.79, h * 0.59);
    ctx.lineTo(w * 0.88, h * 0.49);
    ctx.lineTo(w * 0.95, h * 0.60);
    ctx.lineTo(w, h * 0.57);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Front range — lower, smoother foothills
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.80);
    ctx.lineTo(w * 0.10, h * 0.72);
    ctx.lineTo(w * 0.22, h * 0.78);
    ctx.lineTo(w * 0.34, h * 0.64);
    ctx.lineTo(w * 0.46, h * 0.74);
    ctx.lineTo(w * 0.58, h * 0.67);
    ctx.lineTo(w * 0.70, h * 0.76);
    ctx.lineTo(w * 0.82, h * 0.68);
    ctx.lineTo(w * 0.91, h * 0.77);
    ctx.lineTo(w, h * 0.73);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
}


/** Maps i18n language code to a BCP 47 locale tag for date formatting. */
export function getDateLocale(language: string): string {
    return language === 'is' ? 'is-IS' : 'en-GB';
}

// Shared brand image cache — loaded once, shared across both card types
let _cachedBrand: HTMLImageElement | null = null;
let _loading = false;
const _callbacks: Array<(img: HTMLImageElement) => void> = [];

export function loadBrandImage(onLoad: (img: HTMLImageElement) => void) {
    if (_cachedBrand) { onLoad(_cachedBrand); return; }
    _callbacks.push(onLoad);
    if (_loading) return;
    _loading = true;
    const img = new Image();
    img.src = '/images/hlaupadagskra.avif';
    img.onload = () => {
        _cachedBrand = img;
        _callbacks.forEach(cb => cb(img));
        _callbacks.length = 0;
    };
}

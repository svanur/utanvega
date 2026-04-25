import { Slider, Box, useTheme, useMediaQuery } from '@mui/material';

interface TimeSliderProps {
    /** Current time string (e.g., "5:30" or "3:30:00") */
    value: string;
    /** Callback when slider changes the time */
    onChange: (timeStr: string) => void;
    /** Min value in seconds */
    min: number;
    /** Max value in seconds */
    max: number;
    /** Step in seconds (default 5) */
    step?: number;
    /** Parse time string to minutes */
    parseTime: (val: string) => number | null;
}

function secsToLabel(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compact label for slider marks — shows "2h", "30m", "4:30" etc. */
function secsToMarkLabel(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0 && m === 0) return `${h}h`;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
    return `${m}m`;
}

export default function TimeSlider({ value, onChange, min, max, step = 5, parseTime }: TimeSliderProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const minutes = parseTime(value);
    const currentSecs = minutes != null ? Math.round(minutes * 60) : Math.round((min + max) / 2);
    const clamped = Math.max(min, Math.min(max, currentSecs));

    const marks = (() => {
        const range = max - min;
        // Generate marks at "nice" steps — target ~6 marks max
        const candidates = [15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
        const niceStep = candidates.find(c => c >= range / 6) ?? candidates[candidates.length - 1];
        const allMarks: { value: number; label: string }[] = [];
        for (let v = Math.ceil(min / niceStep) * niceStep; v <= max; v += niceStep) {
            allMarks.push({ value: v, label: isMobile ? secsToMarkLabel(v) : secsToLabel(v) });
        }
        return allMarks;
    })();

    return (
        <Box sx={{ px: 1, mt: -0.5, mb: -0.5 }}>
            <Slider
                value={clamped}
                onChange={(_, val) => onChange(secsToLabel(val as number))}
                min={min}
                max={max}
                step={step}
                valueLabelDisplay="auto"
                valueLabelFormat={secsToLabel}
                marks={marks}
                size="small"
            />
        </Box>
    );
}

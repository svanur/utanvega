import { Slider, Box } from '@mui/material';

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

export default function TimeSlider({ value, onChange, min, max, step = 5, parseTime }: TimeSliderProps) {
    const minutes = parseTime(value);
    const currentSecs = minutes != null ? Math.round(minutes * 60) : Math.round((min + max) / 2);
    const clamped = Math.max(min, Math.min(max, currentSecs));

    const marks = [];
    const range = max - min;
    // Target ~5 marks max; pick a clean step
    const rawStep = range / 5;
    const candidates = [15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
    const markStep = candidates.find(c => c >= rawStep) ?? candidates[candidates.length - 1];
    for (let v = Math.ceil(min / markStep) * markStep; v <= max; v += markStep) {
        marks.push({ value: v, label: secsToLabel(v) });
    }

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

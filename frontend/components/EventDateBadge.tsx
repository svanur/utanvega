import { Chip, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface EventDateBadgeProps {
    dateStr: string;
    endDateStr?: string | null;
}

export default function EventDateBadge({ dateStr, endDateStr }: EventDateBadgeProps) {
    const { t } = useTranslation();

    const weekdays = t('races.weekdays', { returnObjects: true }) as string[];

    const startDate = new Date(dateStr + 'T00:00:00');
    const startDay = startDate.getDay();
    const startFull = weekdays[startDay] ?? '';
    const startShort = startFull.charAt(0).toUpperCase() + startFull.slice(1, 3);

    const endDate = endDateStr ? new Date(endDateStr + 'T00:00:00') : null;
    const isMultiDay = endDate !== null && endDateStr !== dateStr;

    let label: string;
    let isWeekend: boolean;
    let tooltipTitle: string;

    if (isMultiDay && endDate) {
        const endDay = endDate.getDay();
        const endFull = weekdays[endDay] ?? '';
        const endShort = endFull.charAt(0).toUpperCase() + endFull.slice(1, 3);
        label = `${startShort}–${endShort}`;
        isWeekend = startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6;
        tooltipTitle = `${startFull.charAt(0).toUpperCase() + startFull.slice(1)} – ${endFull.charAt(0).toUpperCase() + endFull.slice(1)}`;
    } else {
        label = startShort;
        isWeekend = startDay === 0 || startDay === 6;
        tooltipTitle = startFull.charAt(0).toUpperCase() + startFull.slice(1);
    }

    return (
        <Tooltip title={tooltipTitle} arrow>
            <Chip
                label={label}
                size="small"
                color={isWeekend ? 'info' : 'default'}
                variant={isWeekend ? 'filled' : 'outlined'}
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: isWeekend ? 700 : 400, '.MuiChip-label': { px: 0.75 } }}
            />
        </Tooltip>
    );
}

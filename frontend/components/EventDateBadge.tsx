import { Box, Chip, Tooltip } from '@mui/material';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { useTranslation } from 'react-i18next';
import { useIcelandicHolidays } from '../hooks/useIcelandicHolidays';

interface EventDateBadgeProps {
    dateStr: string;
}

export default function EventDateBadge({ dateStr }: EventDateBadgeProps) {
    const { t } = useTranslation();
    const { getHolidays } = useIcelandicHolidays();

    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = day === 0 || day === 6;
    const holidays = getHolidays(dateStr);
    const isHoliday = holidays.length > 0;

    const weekdays = t('races.weekdays', { returnObjects: true }) as string[];
    const fullName = weekdays[day] ?? '';
    const shortName = fullName.charAt(0).toUpperCase() + fullName.slice(1, 3);

    const weekdayChip = (
        <Tooltip title={fullName.charAt(0).toUpperCase() + fullName.slice(1)} arrow>
            <Chip
                label={shortName}
                size="small"
                color={isWeekend ? 'info' : 'default'}
                variant={isWeekend ? 'filled' : 'outlined'}
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: isWeekend ? 700 : 400, '.MuiChip-label': { px: 0.75 } }}
            />
        </Tooltip>
    );

    if (!isHoliday) return weekdayChip;

    const holidayLabel = holidays.map(h => h.name).join(' · ');
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {weekdayChip}
            <Tooltip title={holidayLabel} arrow>
                <Chip
                    icon={<CelebrationIcon sx={{ fontSize: '14px !important' }} />}
                    label={holidays[0].name}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.68rem', maxWidth: 180, '.MuiChip-label': { px: 0.75 } }}
                />
            </Tooltip>
        </Box>
    );
}

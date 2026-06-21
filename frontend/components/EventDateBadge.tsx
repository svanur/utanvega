import { Chip, Tooltip } from '@mui/material';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { useIcelandicHolidays } from '../hooks/useIcelandicHolidays';

interface EventDateBadgeProps {
    dateStr: string;
}

export default function EventDateBadge({ dateStr }: EventDateBadgeProps) {
    const { getHolidays } = useIcelandicHolidays();

    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = day === 0 || day === 6;
    const holidays = getHolidays(dateStr);
    const isHoliday = holidays.length > 0;

    if (!isHoliday && !isWeekend) return null;

    if (isHoliday) {
        const label = holidays.map(h => h.name).join(' · ');
        return (
            <Tooltip title={label} arrow>
                <Chip
                    icon={<CelebrationIcon sx={{ fontSize: '14px !important' }} />}
                    label={holidays[0].name}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.68rem', maxWidth: 180, '.MuiChip-label': { px: 0.75 } }}
                />
            </Tooltip>
        );
    }

    return (
        <Tooltip title={day === 6 ? 'Laugardagur' : 'Sunnudagur'} arrow>
            <Chip
                icon={<BeachAccessIcon sx={{ fontSize: '14px !important' }} />}
                label="Helgi"
                size="small"
                color="info"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.68rem', '.MuiChip-label': { px: 0.75 } }}
            />
        </Tooltip>
    );
}

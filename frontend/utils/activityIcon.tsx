import { Box, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getActivityIcon } from './getActivityIcon';

interface ActivityIconsProps {
    activityTypes?: string[] | null;
    activityType: string;
}

export function ActivityIcons({ activityTypes, activityType }: ActivityIconsProps) {
    const { t } = useTranslation();
    const types = activityTypes && activityTypes.length > 0 ? activityTypes : [activityType];
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, pt: 0.3, color: 'text.secondary' }}>
            {types.map(type => (
                <Tooltip key={type} title={t(`races.activityTypes.${type}`, { defaultValue: type })}>
                    <span style={{ display: 'flex' }}>{getActivityIcon(type)}</span>
                </Tooltip>
            ))}
        </Box>
    );
}

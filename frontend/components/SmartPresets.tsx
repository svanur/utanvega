import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, Fade } from '@mui/material';
import type { FilterState } from '../hooks/useTrails';
import { getActivePresets } from '../utils/filterPresets';
import type { FilterPreset } from '../utils/filterPresets';

interface SmartPresetsProps {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    defaultFilters: FilterState;
    hasGeolocation?: boolean;
    initialPresetId?: string | null;
    onPresetApply?: (presetId: string | null) => void;
}

const SmartPresets: React.FC<SmartPresetsProps> = ({ filters, setFilters, defaultFilters, hasGeolocation = false, initialPresetId, onPresetApply }) => {
    const { t } = useTranslation();
    const [activePresetId, setActivePresetId] = React.useState<string | null>(initialPresetId ?? null);

    const presets = React.useMemo(() => getActivePresets(new Date(), hasGeolocation), [hasGeolocation]);

    // If user manually changes filters, deactivate the preset
    const prevFiltersRef = React.useRef(filters);
    React.useEffect(() => {
        if (activePresetId && prevFiltersRef.current !== filters) {
            const preset = presets.find(p => p.id === activePresetId);
            if (preset) {
                const isStillMatching = Object.entries(preset.filters).every(([key, value]) => {
                    const current = filters[key as keyof FilterState];
                    if (Array.isArray(value)) {
                        return Array.isArray(current) &&
                            value.length === current.length &&
                            value.every(v => (current as string[]).includes(v));
                    }
                    return current === value;
                });
                if (!isStillMatching) {
                    setActivePresetId(null);
                }
            }
        }
        prevFiltersRef.current = filters;
    }, [filters, activePresetId, presets]);

    const handlePresetClick = (preset: FilterPreset) => {
        if (activePresetId === preset.id) {
            setActivePresetId(null);
            setFilters(defaultFilters);
            onPresetApply?.(null);
        } else {
            setActivePresetId(preset.id);
            setFilters({ ...defaultFilters, ...preset.filters });
            onPresetApply?.(preset.id);
        }
    };

    if (presets.length === 0) return null;

    return (
        <Fade in timeout={400}>
            <Box
                display="flex"
                gap={1}
                mb={1.5}
                sx={{
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                    pb: 0.5,
                }}
            >
                {presets.map(preset => {
                    const active = activePresetId === preset.id;
                    return (
                        <Chip
                            key={preset.id}
                            label={`${preset.emoji} ${t(preset.nameKey)}`}
                            onClick={() => handlePresetClick(preset)}
                            color={active ? 'secondary' : 'default'}
                            variant={active ? 'filled' : 'outlined'}
                            sx={{
                                fontWeight: active ? 'bold' : 'normal',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s ease',
                                borderStyle: active ? 'solid' : 'dashed',
                                opacity: active ? 1 : 0.75,
                                '&:hover': {
                                    opacity: 1,
                                    transform: 'scale(1.03)',
                                },
                            }}
                        />
                    );
                })}
            </Box>
        </Fade>
    );
};

export default SmartPresets;

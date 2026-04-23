import React, { useMemo, useId } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import type { CategoricalChartFunc } from 'recharts/types/chart/types';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ElevationDataPoint {
  distance: number;
  elevation: number;
  totalGain: number;
  gradient: number; // percent grade
  lat: number;
  lng: number;
}

interface ElevationChartProps {
  coordinates: number[][]; // [lon, lat, ele]
  onHover: (point: ElevationDataPoint | null) => void;
  activeIndex?: number | null;
  height?: number;
  compact?: boolean;
}

function getGradientColor(gradient: number): string {
  if (gradient <= 0) return '#4caf50';
  if (gradient <= 5) return '#8bc34a';
  if (gradient <= 8) return '#ffc107';
  if (gradient <= 12) return '#ff9800';
  return '#f44336';
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ElevationDataPoint }> }) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const gradColor = getGradientColor(data.gradient);
    return (
      <Paper sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="body2" fontWeight="bold">
          {t('elevation.distance')}: {data.distance.toFixed(2)} km
        </Typography>
        <Typography variant="body2" color="primary">
          {t('elevation.elevation')}: {Math.round(data.elevation)} m
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('elevation.gainSoFar')}: {Math.round(data.totalGain)} m
        </Typography>
        <Typography variant="body2" sx={{ color: gradColor, fontWeight: 600 }}>
          {t('elevation.grade')}: {data.gradient > 0 ? '+' : ''}{data.gradient.toFixed(1)}%
        </Typography>
      </Paper>
    );
  }
  return null;
}

const ElevationChart: React.FC<ElevationChartProps> = ({ coordinates, onHover, activeIndex, height = 220, compact = false }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const uid = useId();
  const strokeGradientId = `steepnessStroke-${uid}`;
  const fillGradientId = `colorEle-${uid}`;

  const chartData = useMemo(() => {
    let totalDistance = 0;
    let totalGain = 0;
    const data: ElevationDataPoint[] = [];

    for (let i = 0; i < coordinates.length; i++) {
      const current = coordinates[i];
      const lng = current[0];
      const lat = current[1];
      const elevation = current.length > 2 ? current[2] : 0;
      
      if (i > 0) {
        const prev = coordinates[i - 1];
        const prevElevation = prev.length > 2 ? prev[2] : 0;
        const dist = calculateDistance(lat, lng, prev[1], prev[0]);
        totalDistance += dist;
        
        const gain = elevation - prevElevation;
        if (gain > 0) totalGain += gain;
      }

      data.push({
        distance: totalDistance / 1000,
        elevation,
        totalGain,
        gradient: 0, // computed below
        lat,
        lng
      });
    }

    // Compute smoothed gradient (percent grade) for each point
    const windowSize = 5;
    for (let i = 0; i < data.length; i++) {
      const lo = Math.max(0, i - windowSize);
      const hi = Math.min(data.length - 1, i + windowSize);
      const dElev = data[hi].elevation - data[lo].elevation;
      const dDist = (data[hi].distance - data[lo].distance) * 1000;
      data[i].gradient = dDist > 0 ? (dElev / dDist) * 100 : 0;
    }

    return data;
  }, [coordinates]);

  const { minPoint, maxPoint } = useMemo(() => {
    if (chartData.length === 0) return { minPoint: null, maxPoint: null };
    let min = chartData[0], max = chartData[0];
    for (const p of chartData) {
      if (p.elevation < min.elevation) min = p;
      if (p.elevation > max.elevation) max = p;
    }
    return { minPoint: min, maxPoint: max };
  }, [chartData]);

  // Compute steepness gradient stops for the stroke color (sampled to ~100 stops for performance)
  const gradientStops = useMemo(() => {
    if (chartData.length < 2) return [];
    const totalDist = chartData[chartData.length - 1].distance;
    if (totalDist === 0) return [];

    const maxStops = 100;
    const step = Math.max(1, Math.floor(chartData.length / maxStops));
    const stops: { offset: string; color: string }[] = [];
    for (let i = 0; i < chartData.length; i += step) {
      stops.push({
        offset: `${(chartData[i].distance / totalDist) * 100}%`,
        color: getGradientColor(chartData[i].gradient),
      });
    }
    // Always include last point
    const last = chartData[chartData.length - 1];
    if (stops.length === 0 || stops[stops.length - 1].offset !== '100%') {
      stops.push({ offset: '100%', color: getGradientColor(last.gradient) });
    }
    return stops;
  }, [chartData]);

  // Haversine formula to calculate distance between two points in meters
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  const handleMouseMove: CategoricalChartFunc = (state) => {
    if (state?.isTooltipActive && state.activeTooltipIndex != null) {
      const index = Number(state.activeTooltipIndex);
      const point = chartData[index];
      if (point) {
        onHover(point);
        return;
      }
    }
    onHover(null);
  };

  return (
    <Box sx={{ width: '100%', mt: compact ? 0 : 3 }}>
      {!compact && (
        <Typography variant="h6" gutterBottom>
          {t('elevation.title')}
        </Typography>
      )}
      <Box sx={{ width: '100%', height, overflow: 'hidden', touchAction: 'none' }}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => onHover(null)}
            onTouchMove={handleMouseMove}
            onTouchEnd={() => onHover(null)}
          >
            <defs>
              <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
                {gradientStops.map((s, i) => (
                  <stop key={i} offset={s.offset} stopColor={s.color} />
                ))}
              </linearGradient>
              <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8} />
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="distance"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) => `${value.toFixed(1)} km`}
              fontSize={12}
            />
            <YAxis
              dataKey="elevation"
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => `${value} m`}
              fontSize={12}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="elevation"
              stroke={gradientStops.length > 0 && activeIndex == null ? `url(#${strokeGradientId})` : theme.palette.primary.main}
              strokeWidth={activeIndex == null ? 2 : 1}
              fillOpacity={1}
              fill={`url(#${fillGradientId})`}
              isAnimationActive={false}
            />
            {activeIndex != null && chartData[activeIndex] && (
              <ReferenceLine
                x={chartData[activeIndex].distance}
                stroke={theme.palette.warning.main}
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}
            {maxPoint && (
              <ReferenceDot
                x={maxPoint.distance}
                y={maxPoint.elevation}
                r={5}
                fill={theme.palette.error.main}
                stroke="white"
                strokeWidth={2}
                label={{ value: `▲ ${Math.round(maxPoint.elevation)}m`, position: 'insideBottomRight', fontSize: 11, fontWeight: 'bold', fill: theme.palette.error.main, offset: 8 }}
              />
            )}
            {minPoint && (
              <ReferenceDot
                x={minPoint.distance}
                y={minPoint.elevation}
                r={5}
                fill={theme.palette.info.main}
                stroke="white"
                strokeWidth={2}
                label={{ value: `▼ ${Math.round(minPoint.elevation)}m`, position: 'insideTopRight', fontSize: 11, fontWeight: 'bold', fill: theme.palette.info.main, offset: 8 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default ElevationChart;

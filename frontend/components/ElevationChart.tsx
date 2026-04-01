import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Box, Paper, Typography, useTheme } from '@mui/material';

interface ElevationDataPoint {
  distance: number;
  elevation: number;
  totalGain: number;
  lat: number;
  lng: number;
}

interface ElevationChartProps {
  coordinates: number[][]; // [lon, lat, ele]
  onHover: (point: ElevationDataPoint | null) => void;
}

const ElevationChart: React.FC<ElevationChartProps> = ({ coordinates, onHover }) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    let totalDistance = 0;
    let totalGain = 0;
    const data: ElevationDataPoint[] = [];

    for (let i = 0; i < coordinates.length; i++) {
      const current = coordinates[i];
      const lng = current[0];
      const lat = current[1];
      // Check if elevation exists (3rd element in coordinate array)
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
        distance: totalDistance / 1000, // km
        elevation,
        totalGain,
        lat,
        lng
      });
    }

    return data;
  }, [coordinates]);

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ElevationDataPoint;
      return (
        <Paper sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" fontWeight="bold">
            Distance: {data.distance.toFixed(2)} km
          </Typography>
          <Typography variant="body2" color="primary">
            Elevation: {Math.round(data.elevation)} m
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gain so far: {Math.round(data.totalGain)} m
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  const handleMouseMove = (state: any) => {
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
    <Box sx={{ width: '100%', mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Elevation Profile
      </Typography>
      <Box sx={{ width: '100%', height: 220, overflow: 'hidden' }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => onHover(null)}
          >
            <defs>
              <linearGradient id="colorEle" x1="0" y1="0" x2="0" y2="1">
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
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="elevation"
              stroke={theme.palette.primary.main}
              fillOpacity={1}
              fill="url(#colorEle)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default ElevationChart;

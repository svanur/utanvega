import React, { useState, useMemo } from 'react';
import { Box, Typography, Paper, Chip, Stack, TextField, MenuItem, CircularProgress } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTrails, Trail } from '../hooks/useTrails';
import { useLocations } from '../hooks/useLocations';

const activityEmoji: Record<string, string> = {
  TrailRunning: '🏃‍♀️',
  Running: '🏃‍♂️',
  Hiking: '🥾',
  Cycling: '🚴',
};

const statusColors: Record<string, string> = {
  Published: '#2e7d32',
  Draft: '#ed6c02',
  Flagged: '#d32f2f',
  Archived: '#757575',
};

function createPinIcon(trail: Trail) {
  const emoji = activityEmoji[trail.activityType] || '📍';
  const borderColor = statusColors[trail.status] || '#1976d2';
  return L.divIcon({
    className: '',
    html: `<div style="
      font-size: 20px;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      border: 3px solid ${borderColor};
      background: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

interface TrailMapViewProps {
  onEditTrail?: (trailId: string) => void;
}

function FlyToLocation({ lat, lng, radius }: { lat: number; lng: number; radius?: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (radius && radius > 0) {
      // Approximate bounding box from center + radius in meters
      const latOffset = radius / 111320;
      const lngOffset = radius / (111320 * Math.cos(lat * Math.PI / 180));
      const bounds = L.latLngBounds(
        [lat - latOffset, lng - lngOffset],
        [lat + latOffset, lng + lngOffset]
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } else {
      map.flyTo([lat, lng], 11, { duration: 1 });
    }
  }, [lat, lng, radius, map]);
  return null;
}

export default function TrailMapView({ onEditTrail }: TrailMapViewProps) {
  const { trails, loading } = useTrails(false);
  const { locations } = useLocations();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const mappableLocations = useMemo(() =>
    locations.filter(l => l.latitude != null && l.longitude != null),
    [locations]
  );

  const selectedLocation = useMemo(() =>
    locationFilter !== 'all' ? mappableLocations.find(l => l.id === locationFilter) : null,
    [locationFilter, mappableLocations]
  );

  const mappable = useMemo(() => {
    let filtered = trails.filter(t => t.startLatitude != null && t.startLongitude != null);
    if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
    if (activityFilter !== 'all') filtered = filtered.filter(t => t.activityType === activityFilter);
    return filtered;
  }, [trails, statusFilter, activityFilter]);

  const unmappable = trails.filter(t => t.startLatitude == null || t.startLongitude == null).length;

  // Always center on Iceland
  const icelandCenter: [number, number] = [64.9631, -19.0208];

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /><Typography sx={{ mt: 1 }}>Loading trails...</Typography></Box>;
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">Trail Map</Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          select size="small" label="Status" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All Statuses</MenuItem>
          <MenuItem value="Published">Published</MenuItem>
          <MenuItem value="Draft">Draft</MenuItem>
          <MenuItem value="Flagged">Flagged</MenuItem>
          <MenuItem value="Archived">Archived</MenuItem>
        </TextField>

        <TextField
          select size="small" label="Activity" value={activityFilter}
          onChange={e => setActivityFilter(e.target.value)} sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All Activities</MenuItem>
          <MenuItem value="TrailRunning">🏃‍♀️ Trail Running</MenuItem>
          <MenuItem value="Running">🏃‍♂️ Running</MenuItem>
          <MenuItem value="Hiking">🥾 Hiking</MenuItem>
          <MenuItem value="Cycling">🚴 Cycling</MenuItem>
        </TextField>

        <TextField
          select size="small" label="Location" value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)} sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All Locations</MenuItem>
          {mappableLocations.map(loc => (
            <MenuItem key={loc.id} value={loc.id}>📍 {loc.name}</MenuItem>
          ))}
        </TextField>

        <Chip label={`${mappable.length} trails on map`} color="primary" variant="outlined" />
        {unmappable > 0 && (
          <Chip label={`${unmappable} without GPS`} color="warning" variant="outlined" size="small" />
        )}
      </Stack>

      <Paper variant="outlined" sx={{ height: 550, borderRadius: 2, overflow: 'hidden' }}>
        <MapContainer center={icelandCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {selectedLocation && (
            <>
              <FlyToLocation
                lat={selectedLocation.latitude!}
                lng={selectedLocation.longitude!}
                radius={selectedLocation.radius ?? undefined}
              />
              {selectedLocation.radius && selectedLocation.radius > 0 && (
                <Circle
                  center={[selectedLocation.latitude!, selectedLocation.longitude!]}
                  radius={selectedLocation.radius}
                  pathOptions={{ color: '#1976d2', fillColor: '#1976d2', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
                />
              )}
            </>
          )}
          {mappable.map(trail => (
            <Marker
              key={trail.id}
              position={[trail.startLatitude!, trail.startLongitude!]}
              icon={createPinIcon(trail)}
            >
              <Popup>
                <Box sx={{ minWidth: 200 }}>
                  <Typography variant="subtitle2" fontWeight="bold">{trail.name}</Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {trail.activityType} · {trail.trailType} · {trail.difficulty || '—'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {(trail.length / 1000).toFixed(1)} km · ↑{Math.round(trail.elevationGain)}m · ↓{Math.round(trail.elevationLoss)}m
                  </Typography>
                  <Chip
                    label={trail.status}
                    size="small"
                    sx={{ mt: 0.5, mr: 0.5 }}
                    color={trail.status === 'Published' ? 'success' : trail.status === 'Draft' ? 'warning' : 'default'}
                    variant="outlined"
                  />
                  {trail.locations.length > 0 && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      📍 {trail.locations.map(l => l.name).join(', ')}
                    </Typography>
                  )}
                  {onEditTrail && (
                    <Typography
                      variant="caption"
                      sx={{ mt: 1, display: 'block', cursor: 'pointer', color: 'primary.main', fontWeight: 'bold' }}
                      onClick={() => onEditTrail(trail.id)}
                    >
                      ✏️ Edit Trail
                    </Typography>
                  )}
                </Box>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Paper>
    </Box>
  );
}

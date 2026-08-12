import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-expect-error – Leaflet internal
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const ICELAND_CENTER: [number, number] = [64.96, -18.5];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

interface GpxMapPickerProps {
  open: boolean;
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

export default function GpxMapPicker({ open, initialLat, initialLng, onConfirm, onClose }: GpxMapPickerProps) {
  const [pin, setPin] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null
  );

  useEffect(() => {
    if (open) {
      setPin(initialLat != null && initialLng != null ? [initialLat, initialLng] : null);
    }
  }, [open, initialLat, initialLng]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Pick map pin location
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
          Click anywhere on the map to place the pin.
        </Typography>
        <Box sx={{ height: 460 }}>
          <MapContainer
            center={pin ?? ICELAND_CENTER}
            zoom={pin ? 11 : 6}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={(lat, lng) => setPin([lat, lng])} />
            {pin && <Marker position={pin} />}
          </MapContainer>
        </Box>
        {pin && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1, display: 'block' }}>
            {pin[0].toFixed(6)}, {pin[1].toFixed(6)}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={pin == null}
          onClick={() => { if (pin) { onConfirm(pin[0], pin[1]); onClose(); } }}
        >
          Use this location
        </Button>
      </DialogActions>
    </Dialog>
  );
}

'use client';

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  position: { lat: number; lng: number };
  onPositionChange?: (position: { lat: number; lng: number }) => void;
  readOnly?: boolean;
}

function LocationMarker({ position, onPositionChange, readOnly }: MapProps) {
  const map = useMapEvents({
    click(e) {
      if (!readOnly && onPositionChange) {
        onPositionChange(e.latlng);
        map.flyTo(e.latlng, map.getZoom());
      }
    },
  });

  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position ? <Marker position={position} /> : null;
}

export default function Map({ position, onPositionChange, readOnly = false }: MapProps) {
  const defaultCenter = { lat: 24.7136, lng: 46.6753 }; // Riyadh
  const center = position?.lat ? position : defaultCenter;

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm z-0 relative">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={!readOnly}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} onPositionChange={onPositionChange} readOnly={readOnly} />
      </MapContainer>
    </div>
  );
}

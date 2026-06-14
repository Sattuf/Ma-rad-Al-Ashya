'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Link from 'next/link';

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface InteractiveMapProps {
  listings: any[];
}

function MapEvents({ onMoveEnd }: { onMoveEnd: () => void }) {
  useMapEvents({
    moveend: () => {
      onMoveEnd();
    },
  });
  return null;
}

export default function InteractiveMap({ listings }: InteractiveMapProps) {
  const [showSearchArea, setShowSearchArea] = useState(false);

  const defaultCenter = { lat: 24.7136, lng: 46.6753 }; // Riyadh

  const handleSearchArea = () => {
    setShowSearchArea(false);
    // In a real app, this would fetch new listings based on the map's current bounds
    console.log('Search this area clicked');
  };

  const handleMoveEnd = () => {
    setShowSearchArea(true);
  };

  // Custom icon for listings
  const customIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <div className="relative w-full h-full z-0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
      {showSearchArea && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
          <button
            onClick={handleSearchArea}
            className="bg-white px-6 py-2 rounded-full shadow-md text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors border border-gray-200"
          >
            البحث في هذه المنطقة
          </button>
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onMoveEnd={handleMoveEnd} />
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
        >
          {listings.map((listing) => {
            if (!listing.location?.lat || !listing.location?.lng) return null;
            return (
              <Marker
                key={listing.id}
                position={[listing.location.lat, listing.location.lng]}
                icon={customIcon}
              >
                <Popup>
                  <div className="p-1 w-48 text-right" dir="rtl">
                    <Link href={`/listings/${listing.id}`} className="block">
                      {listing.images && listing.images[0] && (
                        <div className="w-full h-24 mb-2 rounded overflow-hidden">
                          <img
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <h3 className="font-bold text-sm text-gray-900 mb-1 truncate">{listing.title}</h3>
                      <p className="text-primary font-bold text-sm">{listing.price} ريال</p>
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

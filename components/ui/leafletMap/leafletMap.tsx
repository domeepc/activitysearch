'use client';

import { MapContainer, TileLayer, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ActivityCard from './activityCard';
import { useEffect } from 'react';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface ActivityData {
  id: string;
  title: string;
  description: string;
  category: string;
  location: {
    name: string;
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  price: {
    amount: number;
    currency: string;
    type: string;
  };
  duration: string;
  difficulty: string;
  rating: number;
  reviewCount: number;
  images?: string[];
}

const CustomMarker = ({ activity }: { activity: ActivityData }) => {
  const map = useMap();
  
  const customIcon = L.divIcon({
    html: '<div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: white; border-radius: 50%; border: 2px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>',
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
  
  return (
    <Marker icon={customIcon}
      position={[activity.location.coordinates.lat, activity.location.coordinates.lng]}
      eventHandlers={{
        click: () => {
          map.flyTo([activity.location.coordinates.lat, activity.location.coordinates.lng], 15, { duration: 1 });
        },
      }}
    >
      <Popup className='max-w-max shadow-lg'>
        <ActivityCard activity={activity} />
      </Popup>
    </Marker>
  );
};


// Component to handle map updates
const MapUpdater = ({ selectedActivity }: { selectedActivity: ActivityData | null }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedActivity) {
      map.flyTo(
        [selectedActivity.location.coordinates.lat, selectedActivity.location.coordinates.lng],
        15,
        { duration: 1.5 }
      );
      
      // Open the popup for the selected activity
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const marker = layer as L.Marker;
          const position = marker.getLatLng();
          if (
            position.lat === selectedActivity.location.coordinates.lat &&
            position.lng === selectedActivity.location.coordinates.lng
          ) {
            marker.openPopup();
          }
        }
      });
    }
  }, [selectedActivity, map]);

  return null;
};

export default function OpenStreetMapComponent({ 
  activities = [], 
  selectedActivity = null 
}: { 
  activities?: ActivityData[];
  selectedActivity?: ActivityData | null;
}) {
  const defaultCenter: [number, number] = [43.5113657, 16.4688471];

  return (
    <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }} attributionControl={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapUpdater selectedActivity={selectedActivity} />
      {activities.map((activity) => (
        <CustomMarker key={activity.id} activity={activity} />
      ))}
    </MapContainer>
  );
}

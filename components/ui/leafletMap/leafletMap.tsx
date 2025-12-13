'use client';

import { MapContainer, TileLayer, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ActivityCard from './activityCard';

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
  
  return (
    <Marker 
      position={[activity.location.coordinates.lat, activity.location.coordinates.lng]}
      eventHandlers={{
        click: () => {
          map.flyTo([activity.location.coordinates.lat, activity.location.coordinates.lng], 14, { duration: 1 });
        },
      }}
    >
      <Popup>
        <ActivityCard activity={activity} />
      </Popup>
    </Marker>
  );
};


export default function OpenStreetMapComponent({ activities = [] }: { activities?: ActivityData[] }) {
  const defaultCenter: [number, number] = [43.5113657, 16.4688471];

  return (
    <MapContainer center={defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {activities.map((activity) => (
        <CustomMarker key={activity.id} activity={activity} />
      ))}
    </MapContainer>
  );
}

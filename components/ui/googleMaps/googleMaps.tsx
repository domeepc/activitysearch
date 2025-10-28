'use client';
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from '@react-google-maps/api';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, X } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const center = {
  lat: 37.437041393899676,
  lng: -4.191635586788259,
};

// Bluish custom map styles
const mapStyles = [
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a6fa5' }],
  },
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#f5f5f5' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#7ea1d1' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#a7c4e0' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry.fill',
    stylers: [{ color: '#e8f1f8' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#5b7fa8' }, { weight: '0.30' }],
  },
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'poi.attraction',
    elementType: 'geometry.fill',
    stylers: [{ color: '#c5ddf5' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#b8e0d2' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'all',
    stylers: [{ saturation: '-20' }, { visibility: 'on' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#c8dded' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#9bb8d3' }, { weight: '0.50' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.fill',
    stylers: [{ color: '#f0f6fb' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.fill',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'transit.station.airport',
    elementType: 'geometry.fill',
    stylers: [{ color: '#d5e8f7' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#6ba3d0' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a789f' }],
  },
];

const mapOptions = {
  styles: mapStyles,
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy' as const,
};

interface MarkerInfo {
  title: string;
  description: string;
  organizerName: string;
  date?: string;
  time?: string;
}

interface MarkerData {
  id: string;
  position: google.maps.LatLngLiteral;
  info?: MarkerInfo;
}

interface GoogleMapComponentProps {
  onMarkerAdd?: (marker: MarkerData) => void;
  markers?: MarkerData[];
  isOrganizer?: boolean;
}

export default function GoogleMapComponent({
  markers = [],
  isOrganizer = false,
}: GoogleMapComponentProps) {
  const [mapMarkers] = useState<MarkerData[]>(markers);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [editingMarker] = useState<string | null>(null);
  const [markerForm, setMarkerForm] = useState<MarkerInfo>({
    title: '',
    description: '',
    organizerName: '',
    date: '',
    time: '',
  });

  // Custom marker icon - defined inside component to avoid 'google is not defined' error
  const customMarkerIcon = {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: '#3b82f6',
    fillOpacity: 1,
    strokeColor: '#1e40af',
    strokeWeight: 2,
    scale: 2,
  };

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={10}
        options={mapOptions}
      >
        {mapMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            animation={google.maps.Animation.DROP}
            icon={customMarkerIcon}
          >
            {selectedMarker === marker.id && marker.info && (
              <InfoWindow
                position={marker.position}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div className="p-2 max-w-xs">
                  <h3 className="font-semibold text-lg mb-2">
                    {marker.info.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {marker.info.description}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong>Organizer:</strong> {marker.info.organizerName}
                    </p>
                    {marker.info.date && (
                      <p>
                        <strong>Date:</strong> {marker.info.date}
                      </p>
                    )}
                    {marker.info.time && (
                      <p>
                        <strong>Time:</strong> {marker.info.time}
                      </p>
                    )}
                  </div>
                  {isOrganizer && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-3 w-full"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Delete Event
                    </Button>
                  )}
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>

      {/* Marker Info Form */}
      {editingMarker && isOrganizer && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-6 w-full max-w-md z-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Add Event Details</h3>
            </div>
            <Button variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Event Title *
              </label>
              <Input
                placeholder="e.g., Morning Yoga Session"
                value={markerForm.title}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, title: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Description *
              </label>
              <Textarea
                placeholder="Describe the activity..."
                value={markerForm.description}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Organizer Name *
              </label>
              <Input
                placeholder="Your name or organization"
                value={markerForm.organizerName}
                onChange={(e) =>
                  setMarkerForm({
                    ...markerForm,
                    organizerName: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input
                  type="date"
                  value={markerForm.date}
                  onChange={(e) =>
                    setMarkerForm({ ...markerForm, date: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Time</label>
                <Input
                  type="time"
                  value={markerForm.time}
                  onChange={(e) =>
                    setMarkerForm({ ...markerForm, time: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={
                  !markerForm.title ||
                  !markerForm.description ||
                  !markerForm.organizerName
                }
              >
                Save Event
              </Button>
            </div>
          </div>
        </div>
      )}
    </LoadScript>
  );
}

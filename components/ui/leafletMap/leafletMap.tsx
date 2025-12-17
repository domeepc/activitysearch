"use client";

import { MapContainer, TileLayer, Popup, Marker, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import ActivityCard from "./activityCard";
import { useEffect } from "react";
import { ActivityData } from "@/lib/types/activity";

// Add styles to make Leaflet popups invisible
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    .leaflet-popup-content-wrapper {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      pointer-events: auto !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      pointer-events: auto !important;
    }
    .leaflet-popup-tip {
      display: none !important;
    }
    .leaflet-popup {
      pointer-events: none !important;
    }
    .leaflet-popup-pane {
      z-index: 1000 !important;
    }
    button[aria-label="Close popup"] {
      z-index: 10000 !important;
      position: relative !important;
    }
  `;
  if (!document.head.querySelector("#leaflet-popup-invisible")) {
    style.id = "leaflet-popup-invisible";
    document.head.appendChild(style);
  }
}

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Component to handle popup close with map access
const PopupContent = ({ activity }: { activity: ActivityData }) => {
  const map = useMap();

  const handleClose = () => {
    map.closePopup();
  };

  return (
    <ActivityCard activity={activity} onClose={handleClose} isExpanded={true} />
  );
};

const CustomMarker = ({ activity }: { activity: ActivityData }) => {
  const map = useMap();

  const customIcon = L.divIcon({
    html: '<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: white; border-radius: 50%; border: 2px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><svg width="24" color="#3b82f6" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>',
    className: "custom-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  return (
    <Marker
      icon={customIcon}
      position={[
        activity.location.coordinates.lat,
        activity.location.coordinates.lng,
      ]}
      eventHandlers={{
        click: () => {
          map.flyTo(
            [
              activity.location.coordinates.lat,
              activity.location.coordinates.lng,
            ],
            15,
            { duration: 1 }
          );
        },
      }}
    >
      <Popup closeButton={false}>
        <PopupContent activity={activity} />
      </Popup>
    </Marker>
  );
};

// Component to handle map updates
const MapUpdater = ({
  selectedActivity,
}: {
  selectedActivity: ActivityData | null;
}) => {
  const map = useMap();

  useEffect(() => {
    if (selectedActivity) {
      map.flyTo(
        [
          selectedActivity.location.coordinates.lat,
          selectedActivity.location.coordinates.lng,
        ],
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
  selectedActivity = null,
}: {
  activities?: ActivityData[];
  selectedActivity?: ActivityData | null;
}) {
  const defaultCenter: [number, number] = [43.5113657, 16.4688471];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <MapUpdater selectedActivity={selectedActivity} />
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        // Disable spiderfy on max zoom to avoid spider-leg lines; prefer zoom-to-bounds
        spiderfyOnMaxZoom={false}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
        iconCreateFunction={(cluster: { getChildCount: () => unknown }) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div style="display: flex; align-items: center; justify-content: center; width: 60px; height: 60px; background: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); color: white; font-weight: bold; font-size: 1rem">${count}</div>`,
            className: "custom-cluster-icon",
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40],
          });
        }}
      >
        {activities.map((activity) => (
          <CustomMarker key={activity.id} activity={activity} />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

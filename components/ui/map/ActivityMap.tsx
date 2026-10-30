"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { getVersion, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import ActivityCard from "@/components/ui/leafletMap/activityCard";
import { ActivityData } from "@/lib/types/activity";

/**
 * OpenFreeMap: free vector tiles, no API key or account, no request limits.
 * Override with NEXT_PUBLIC_MAP_STYLE_LIGHT / NEXT_PUBLIC_MAP_STYLE_DARK to self-host or switch.
 */
const MAP_STYLE = {
  light:
    process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ??
    "https://tiles.openfreemap.org/styles/liberty",
  dark:
    process.env.NEXT_PUBLIC_MAP_STYLE_DARK ??
    "https://tiles.openfreemap.org/styles/dark",
};

// Worker is copied to /public by scripts/copy-maplibre-worker.mjs (postinstall,
// predev, prebuild); the default lookup next to maplibre's own script breaks once
// it is bundled. Keep the `.js` extension: the auth middleware matcher skips
// `.js` static files but not `.mjs`, and maplibre still loads it as a module worker.
setWorkerUrl(`/maplibre-gl-worker.js?v=${getVersion()}`);

const DEFAULT_CENTER = { latitude: 43.5113657, longitude: 16.4688471 };
const SOURCE_ID = "activities";
const CLUSTER_LAYER = "activity-clusters";
const POINT_LAYER = "activity-points";

export default function ActivityMap({
  activities = [],
  selectedActivity = null,
}: {
  activities?: ActivityData[];
  selectedActivity?: ActivityData | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [openId, setOpenId] = useState<string | null>(null);

  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: activities.map((a) => ({
        type: "Feature",
        properties: { id: a.id },
        geometry: {
          type: "Point",
          coordinates: [a.location.coordinates.lng, a.location.coordinates.lat],
        },
      })),
    }),
    [activities]
  );

  const openActivity = activities.find((a) => a.id === openId) ?? null;

  const flyToActivity = useCallback((activity: ActivityData, duration = 1000) => {
    const { lat, lng } = activity.location.coordinates;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration });
  }, []);

  // Search / list selection from outside the map: open its card…
  const [prevSelected, setPrevSelected] = useState(selectedActivity);
  if (selectedActivity !== prevSelected) {
    setPrevSelected(selectedActivity);
    setOpenId(selectedActivity?.id ?? null);
  }
  // …and move the camera to it.
  useEffect(() => {
    if (selectedActivity) flyToActivity(selectedActivity, 1500);
  }, [selectedActivity, flyToActivity]);

  const handleClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const map = mapRef.current;

      if (feature.layer.id === CLUSTER_LAYER && map) {
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        const zoom = await source?.getClusterExpansionZoom(
          feature.properties?.cluster_id as number
        );
        const [lng, lat] = (feature.geometry as Point).coordinates;
        map.easeTo({ center: [lng, lat], zoom: zoom ?? map.getZoom() + 2, duration: 500 });
        return;
      }

      const activity = activities.find((a) => a.id === feature.properties?.id);
      if (activity) {
        flyToActivity(activity);
        setOpenId(activity.id);
      }
    },
    [activities, flyToActivity]
  );

  const markerStroke = isDark ? "#18181b" : "#ffffff";

  return (
    <Map
      ref={mapRef}
      initialViewState={{ ...DEFAULT_CENTER, zoom: 13 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={isDark ? MAP_STYLE.dark : MAP_STYLE.light}
      interactiveLayerIds={[CLUSTER_LAYER, POINT_LAYER]}
      onClick={handleClick}
      cursor="auto"
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="bottom-right" showCompass={false} />

      <Source
        id={SOURCE_ID}
        type="geojson"
        data={geojson}
        cluster
        clusterRadius={50}
        clusterMaxZoom={14}
      >
        <Layer
          id={CLUSTER_LAYER}
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": "#2563eb",
            "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30],
            "circle-stroke-width": 3,
            "circle-stroke-color": markerStroke,
          }}
        />
        <Layer
          id="activity-cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
            "text-font": ["Noto Sans Bold"],
          }}
          paint={{ "text-color": "#ffffff" }}
        />
        <Layer
          id={POINT_LAYER}
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": "#2563eb",
            "circle-radius": ["case", ["==", ["get", "id"], openId ?? ""], 12, 9],
            "circle-stroke-width": 3,
            "circle-stroke-color": markerStroke,
          }}
        />
      </Source>

      {openActivity && (
        <Popup
          longitude={openActivity.location.coordinates.lng}
          latitude={openActivity.location.coordinates.lat}
          anchor="bottom"
          offset={16}
          closeButton={false}
          closeOnClick={false}
          maxWidth="none"
          className="activity-popup"
          onClose={() => setOpenId(null)}
        >
          <ActivityCard
            activity={openActivity}
            onClose={() => setOpenId(null)}
            isExpanded
          />
        </Popup>
      )}
    </Map>
  );
}

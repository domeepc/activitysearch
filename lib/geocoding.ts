import type { AddressCoordinates } from "@/lib/types/coordinates";

/**
 * Geocode an address using OpenStreetMap Nominatim
 */
export async function geocodeAddress(
  address: string
): Promise<AddressCoordinates | null> {
  if (!address || !address.trim()) return null;
  
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=hr&q=${encodeURIComponent(
        address
      )}`,
      { headers: { "User-Agent": "activitysearch/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    return {
      latitude: parseFloat(first.lat),
      longitude: parseFloat(first.lon),
    };
  } catch (err) {
    console.error("geocode error", err);
    return null;
  }
}


/**
 * OpenFreeMap: free vector tiles, no API key or account, no request limits.
 * Override with NEXT_PUBLIC_MAP_STYLE_LIGHT / NEXT_PUBLIC_MAP_STYLE_DARK to self-host or switch.
 */
export const MAP_STYLE = {
  light:
    process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ??
    "https://tiles.openfreemap.org/styles/liberty",
  dark:
    process.env.NEXT_PUBLIC_MAP_STYLE_DARK ??
    "https://tiles.openfreemap.org/styles/dark",
};

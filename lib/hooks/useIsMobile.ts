"use client";

import { useSyncExternalStore } from "react";

function getSnapshot(): boolean {
  return typeof window !== "undefined"
    ? window.matchMedia("(max-width: 767px)").matches
    : false;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mediaQuery = window.matchMedia("(max-width: 767px)");
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  }
  mediaQuery.addListener(onStoreChange);
  return () => mediaQuery.removeListener(onStoreChange);
}

/**
 * Hook to detect if the current viewport is mobile (< 768px)
 * Returns false initially for SSR safety, then updates on mount
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

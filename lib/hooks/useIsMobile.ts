"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect if the current viewport is mobile (< 768px)
 * Returns false initially for SSR safety, then updates on mount
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === "undefined") {
      return;
    }

    // Create media query for mobile viewport (< 768px)
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Create event handler
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // Add listener (modern browsers)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => {
        mediaQuery.removeListener(handleChange);
      };
    }
  }, []);

  return isMobile;
}

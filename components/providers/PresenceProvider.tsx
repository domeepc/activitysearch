"use client";

import { ReactNode, useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/hooks/usePresence";

/**
 * Keeps the signed-in user's `presence.lastSeen` fresh while a tab is visible.
 * Online status is derived from that timestamp — no websocket service needed.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    if (!isAuthenticated) return;

    const beat = () => {
      if (document.visibilityState === "visible") {
        heartbeat().catch(() => {});
      }
    };

    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [isAuthenticated, heartbeat]);

  return <>{children}</>;
}

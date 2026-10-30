"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export type PresenceStatus = "online" | "offline";

export interface PresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeen: number | null;
}

/** How often each visible tab reports in (see PresenceProvider). */
export const HEARTBEAT_INTERVAL_MS = 30_000;
/** A user is "online" if their last heartbeat is newer than this. */
export const ONLINE_WINDOW_MS = 75_000;

/** Re-render periodically so "online" expires even when no new data arrives. */
function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function usePresenceList(userIds: (Id<"users"> | string | undefined)[]) {
  const key = userIds.filter(Boolean).join(",");
  const ids = useMemo(
    () => (key ? ([...new Set(key.split(","))] as Id<"users">[]) : []),
    [key]
  );
  const rows = useQuery(api.presence.getLastSeen, ids.length ? { userIds: ids } : "skip");
  const now = useNow();

  const presences = useMemo(() => {
    const map = new Map<string, PresenceData>();
    for (const row of rows ?? []) {
      const online = row.lastSeen !== null && now - row.lastSeen < ONLINE_WINDOW_MS;
      map.set(row.userId, {
        userId: row.userId,
        status: online ? "online" : "offline",
        lastSeen: row.lastSeen,
      });
    }
    return map;
  }, [rows, now]);

  return { presences, isLoading: rows === undefined && ids.length > 0, now };
}

export function usePresence(userId: Id<"users"> | string | undefined) {
  const { presences, isLoading, now } = usePresenceList([userId]);
  return { presence: userId ? presences.get(userId) ?? null : null, isLoading, now };
}

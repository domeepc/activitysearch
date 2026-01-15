"use client";

import { useEffect, useState, useCallback } from "react";
import { usePresenceContext } from "@/components/PresenceProvider";

export type PresenceStatus = "online" | "away" | "offline";

export interface PresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeen: number;
}

const PRESENCE_CHANNEL = "presence:users";

export function usePresence(userId: string | undefined) {
  const { client, isConnected } = usePresenceContext();
  const [presence, setPresence] = useState<PresenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || !userId || !isConnected) {
      setIsLoading(false);
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    let mounted = true;

    // Subscribe to presence events for this user
    const handlePresenceMessage = (message: any) => {
      if (!mounted || message.clientId !== userId) return;

      if (message.action === "enter" || message.action === "update") {
        const data = message.data as PresenceData;
        setPresence(data);
        setIsLoading(false);
      } else if (message.action === "leave") {
        setPresence({
          userId,
          status: "offline",
          lastSeen: Date.now(),
        });
        setIsLoading(false);
      }
    };

    // Get current presence state
    channel.presence.get({ clientId: userId }, (err, members) => {
      if (err || !mounted) {
        setIsLoading(false);
        return;
      }

      const member = members?.find((m) => m.clientId === userId);
      if (member && member.data) {
        setPresence(member.data as PresenceData);
      } else {
        setPresence({
          userId,
          status: "offline",
          lastSeen: Date.now(),
        });
      }
      setIsLoading(false);
    });

    // Subscribe to presence updates
    channel.presence.subscribe(handlePresenceMessage);

    return () => {
      mounted = false;
      channel.presence.unsubscribe(handlePresenceMessage);
    };
  }, [client, userId, isConnected]);

  return { presence, isLoading };
}

export function usePresenceList(userIds: string[]) {
  const { client, isConnected } = usePresenceContext();
  const [presences, setPresences] = useState<Map<string, PresenceData>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || userIds.length === 0 || !isConnected) {
      setIsLoading(false);
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    let mounted = true;
    const userIdSet = new Set(userIds);

    const updatePresences = () => {
      channel.presence.get((err, members) => {
        if (err || !mounted) {
          setIsLoading(false);
          return;
        }

        const newPresences = new Map<string, PresenceData>();

        // Initialize all requested users as offline
        userIds.forEach((userId) => {
          newPresences.set(userId, {
            userId,
            status: "offline",
            lastSeen: Date.now(),
          });
        });

        // Update with actual presence data
        members?.forEach((member) => {
          if (userIdSet.has(member.clientId) && member.data) {
            newPresences.set(member.clientId, member.data as PresenceData);
          }
        });

        setPresences(newPresences);
        setIsLoading(false);
      });
    };

    // Initial fetch
    updatePresences();

    // Subscribe to presence updates
    const handlePresenceMessage = (message: any) => {
      if (!mounted || !userIdSet.has(message.clientId)) return;

      if (message.action === "enter" || message.action === "update") {
        const data = message.data as PresenceData;
        setPresences((prev) => {
          const next = new Map(prev);
          next.set(message.clientId, data);
          return next;
        });
      } else if (message.action === "leave") {
        setPresences((prev) => {
          const next = new Map(prev);
          next.set(message.clientId, {
            userId: message.clientId,
            status: "offline",
            lastSeen: Date.now(),
          });
          return next;
        });
      }
    };

    channel.presence.subscribe(handlePresenceMessage);

    return () => {
      mounted = false;
      channel.presence.unsubscribe(handlePresenceMessage);
    };
  }, [client, userIds.join(","), isConnected]);

  return { presences, isLoading };
}

export function useUpdatePresence() {
  const { client, isConnected, userId } = usePresenceContext();

  const updatePresence = useCallback(
    (status: PresenceStatus = "online") => {
      if (!client || !isConnected || !userId) {
        return;
      }

      const channel = client.channels.get(PRESENCE_CHANNEL);
      const presenceData: PresenceData = {
        userId,
        status,
        lastSeen: Date.now(),
      };

      // Enter or update presence using promise
      channel.presence.enter(presenceData).catch((err) => {
        console.error("Failed to update presence:", err);
      });
    },
    [client, isConnected, userId]
  );

  const leavePresence = useCallback(() => {
    if (!client || !userId) {
      return;
    }

    // Check if connection is still open
    const connectionState = client.connection.state;
    if (connectionState === "closed" || connectionState === "failed") {
      // Connection already closed, nothing to do
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    const channelState = channel.state;
    
    // Only try to leave if channel is attached (presence operations require attached channel)
    if (channelState !== "attached") {
      // Channel not attached, can't leave presence
      return;
    }

    // Leave presence without data (Ably will automatically remove the client)
    channel.presence.leave().catch((err) => {
      // Ignore errors if connection/channel is already closed or in incompatible state
      const errorMsg = err?.message || String(err);
      if (errorMsg && 
          !errorMsg.includes("Connection closed") && 
          !errorMsg.includes("closed") &&
          !errorMsg.includes("incompatible state") &&
          !errorMsg.includes("detaching") &&
          !errorMsg.includes("detached")) {
        console.error("Failed to leave presence:", err);
      }
    });
  }, [client, userId]);

  return { updatePresence, leavePresence };
}

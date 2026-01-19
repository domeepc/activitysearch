"use client";

import { useEffect, useState, useCallback } from "react";
import { usePresenceContext } from "@/components/providers/PresenceProvider";

export type PresenceStatus = "online" | "away" | "offline";

export interface PresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeen: number;
}

// Ably types - using flexible typing since Ably is dynamically imported
interface AblyChannel {
  state: "initialized" | "attaching" | "attached" | "detaching" | "detached" | "failed" | "suspended";
  presence: {
    get: (paramsOrCallback?: unknown, callback?: unknown) => void;
    subscribe: (callback: (message: AblyPresenceMessage) => void) => Promise<void> | void;
    unsubscribe: (callback: (message: AblyPresenceMessage) => void) => void;
    enter: (data: PresenceData) => Promise<void>;
    leave: () => Promise<void>;
  };
  once: (event: string, callback: (...args: unknown[]) => void) => void;
  attach: (callback?: (err: Error | null) => void) => void;
}

interface AblyPresenceMember {
  clientId: string;
  data: PresenceData;
}

interface AblyPresenceMessage {
  clientId: string;
  action: "enter" | "update" | "leave" | "absent" | "present";
  data: PresenceData;
}

const PRESENCE_CHANNEL = "presence:users";

// Helper function to ensure channel is attached
async function ensureChannelAttached(channel: AblyChannel): Promise<void> {
  if (channel.state === "attached") {
    return;
  }

  return new Promise((resolve, reject) => {
    // If already attaching, wait for it
    if (channel.state === "attaching") {
      channel.once("attached", () => resolve());
      channel.once("failed", (err?: unknown) => reject(err as Error));
      return;
    }

    // Attach the channel
    channel.attach((err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function usePresence(userId: string | undefined) {
  const { client, isConnected } = usePresenceContext();
  const [presence, setPresence] = useState<PresenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || !userId || !isConnected) {
      // Defer state update to avoid synchronous setState in effect
      setTimeout(() => setIsLoading(false), 0);
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    let mounted = true;

    // Subscribe to presence events for this user
    const handlePresenceMessage = (message: AblyPresenceMessage) => {
      if (!mounted || message.clientId !== userId) return;

      if (message.action === "enter" || message.action === "update" || message.action === "absent") {
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

    // Attach channel and then subscribe to presence
    ensureChannelAttached(channel as unknown as AblyChannel)
      .then(() => {
        if (!mounted) return;

        // Get current presence state
        (channel.presence.get as unknown as (params: { clientId: string }, callback: (err: Error | null, members: AblyPresenceMember[] | null) => void) => void)(
          { clientId: userId },
          (err: Error | null, members: AblyPresenceMember[] | null) => {
            if (err || !mounted) {
              setIsLoading(false);
              return;
            }

            const member = members?.find((m: AblyPresenceMember) => m.clientId === userId);
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
          }
        );

        // Subscribe to presence updates
        (channel.presence.subscribe as unknown as (callback: (message: AblyPresenceMessage) => void) => void)(handlePresenceMessage);
      })
      .catch((err) => {
        console.error("Failed to attach presence channel:", err);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
      (channel.presence.unsubscribe as unknown as (callback: (message: AblyPresenceMessage) => void) => void)(handlePresenceMessage);
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
  const userIdsKey = userIds.join(",");

  useEffect(() => {
    if (!client || userIds.length === 0 || !isConnected) {
      // Defer state update to avoid synchronous setState in effect
      setTimeout(() => setIsLoading(false), 0);
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    let mounted = true;
    const userIdSet = new Set(userIds);
    let handlePresenceMessage: ((message: AblyPresenceMessage) => void) | null = null;

    const updatePresences = () => {
      (channel.presence.get as (callback: (err: Error | null, members: AblyPresenceMember[] | null) => void) => void)(
        (err: Error | null, members: AblyPresenceMember[] | null) => {
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
          members?.forEach((member: AblyPresenceMember) => {
            if (userIdSet.has(member.clientId) && member.data) {
              newPresences.set(member.clientId, member.data as PresenceData);
            }
          });

          setPresences(newPresences);
          setIsLoading(false);
        }
      );
    };

    // Attach channel and then fetch and subscribe to presence
    ensureChannelAttached(channel as unknown as AblyChannel)
      .then(() => {
        if (!mounted) return;

        // Initial fetch
        updatePresences();

        // Subscribe to presence updates
        handlePresenceMessage = (message: AblyPresenceMessage) => {
          if (!mounted || !userIdSet.has(message.clientId)) return;

          if (message.action === "enter" || message.action === "update" || message.action === "absent") {
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

        (channel.presence.subscribe as unknown as (callback: (message: AblyPresenceMessage) => void) => void)(handlePresenceMessage);
      })
      .catch((err) => {
        console.error("Failed to attach presence channel:", err);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
      if (handlePresenceMessage) {
        (channel.presence.unsubscribe as unknown as (callback: (message: AblyPresenceMessage) => void) => void)(handlePresenceMessage);
      }
    };
  }, [client, userIdsKey, isConnected, userIds]);

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

      // Ensure channel is attached before entering presence
      ensureChannelAttached(channel as unknown as AblyChannel)
        .then(() => {
          // Enter or update presence using promise
          return channel.presence.enter(presenceData);
        })
        .catch((err) => {
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

    // Only try to leave if channel is attached or attaching (presence operations require attached channel)
    if (channelState !== "attached" && channelState !== "attaching") {
      // Try to attach first, then leave
      ensureChannelAttached(channel as unknown as AblyChannel)
        .then(() => {
          // Leave presence without data (Ably will automatically remove the client)
          return channel.presence.leave();
        })
        .catch((err) => {
          // Ignore errors if connection/channel is already closed or in incompatible state
          const errorMsg = err?.message || String(err);
          if (
            errorMsg &&
            !errorMsg.includes("Connection closed") &&
            !errorMsg.includes("closed") &&
            !errorMsg.includes("incompatible state") &&
            !errorMsg.includes("detaching") &&
            !errorMsg.includes("detached")
          ) {
            console.error("Failed to leave presence:", err);
          }
        });
      return;
    }

    // Leave presence without data (Ably will automatically remove the client)
    channel.presence.leave().catch((err) => {
      // Ignore errors if connection/channel is already closed or in incompatible state
      const errorMsg = err?.message || String(err);
      if (
        errorMsg &&
        !errorMsg.includes("Connection closed") &&
        !errorMsg.includes("closed") &&
        !errorMsg.includes("incompatible state") &&
        !errorMsg.includes("detaching") &&
        !errorMsg.includes("detached")
      ) {
        console.error("Failed to leave presence:", err);
      }
    });
  }, [client, userId]);

  return { updatePresence, leavePresence };
}

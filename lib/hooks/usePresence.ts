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
      console.log(`usePresence: Missing requirements for ${userId}:`, {
        hasClient: !!client,
        hasUserId: !!userId,
        isConnected,
      });
      setIsLoading(false);
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    // Set a timeout to stop loading if it takes too long
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn(`Presence loading timeout for ${userId}, falling back to offline`);
        setIsLoading(false);
        setPresence({
          userId,
          status: "offline",
          lastSeen: Date.now(),
        });
      }
    }, 5000); // 5 second timeout

    // Attach to channel first (required for presence)
    channel.attach((err) => {
      if (err) {
        console.error(`Failed to attach to presence channel for ${userId}:`, err);
        if (timeoutId) clearTimeout(timeoutId);
        setIsLoading(false);
        setPresence({
          userId,
          status: "offline",
          lastSeen: Date.now(),
        });
        return;
      }

      console.log(`Channel attached for ${userId}, getting presence...`);

      // Get current presence state for this specific user
      // Get all members and filter for our user
      channel.presence.get((err, members) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (err || !mounted) {
          console.error(`Failed to get presence for ${userId}:`, err);
          setIsLoading(false);
          if (!mounted) return;
          setPresence({
            userId,
            status: "offline",
            lastSeen: Date.now(),
          });
          return;
        }

        console.log(`Presence members for ${userId}:`, members?.length || 0, members);

        const member = members?.find((m) => m.clientId === userId);
        if (member && member.data) {
          const data = member.data as PresenceData;
          console.log(`Found presence for ${userId}:`, data);
          setPresence(data);
        } else {
          // User not present, set as offline
          console.log(`No presence found for ${userId}, setting offline`);
          setPresence({
            userId,
            status: "offline",
            lastSeen: Date.now(),
          });
        }
        setIsLoading(false);
      });

      // Subscribe to presence updates for this specific user
      const handlePresenceMessage = (message: any) => {
        if (!mounted) return;
        
        // Only process messages for the user we're tracking
        if (message.clientId !== userId) return;

        console.log(`Presence event for ${userId}:`, message.action, message.data);

        if (message.action === "enter" || message.action === "update") {
          const data = message.data as PresenceData;
          if (data && data.userId === userId) {
            setPresence(data);
            setIsLoading(false);
          }
        } else if (message.action === "leave") {
          setPresence({
            userId,
            status: "offline",
            lastSeen: Date.now(),
          });
          setIsLoading(false);
        }
      };

      channel.presence.subscribe(handlePresenceMessage);

      return () => {
        if (mounted) {
          channel.presence.unsubscribe(handlePresenceMessage);
        }
      };
    });

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
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

    // Attach to channel first (required for presence)
    channel.attach((err) => {
      if (err) {
        console.error("Failed to attach to presence channel:", err);
        setIsLoading(false);
        return;
      }

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
        channel.presence.unsubscribe(handlePresenceMessage);
      };
    });

    return () => {
      mounted = false;
    };
  }, [client, userIds.join(","), isConnected]);

  return { presences, isLoading };
}

export function useUpdatePresence() {
  const { client, isConnected, userId } = usePresenceContext();

  const updatePresence = useCallback(
    (status: PresenceStatus = "online") => {
      if (!client || !userId) {
        console.warn(`Cannot update presence: missing client or userId`, { hasClient: !!client, userId });
        return;
      }

      // Check connection state directly from client
      const connectionState = client.connection.state;
      if (connectionState !== "connected" && connectionState !== "connecting") {
        console.log(`Ably not connected (state: ${connectionState}), cannot update presence for ${userId}`);
        return;
      }

      const channel = client.channels.get(PRESENCE_CHANNEL);
      const channelState = channel.state;
      
      // Don't perform operations if channel is detaching or detached
      if (channelState === "detaching" || channelState === "detached") {
        console.log(`Channel is ${channelState}, cannot update presence. Will attach first.`);
        // If detaching or detached, attach first
        channel.attach((err) => {
          if (err) {
            console.error("Failed to attach channel for presence update:", err);
            return;
          }

          const presenceData: PresenceData = {
            userId,
            status,
            lastSeen: Date.now(),
          };

          channel.presence.enter(presenceData)
            .then(() => {
              console.log(`Presence updated: ${userId} is now ${status}`);
            })
            .catch((err) => {
              // Ignore errors if channel state changed during operation
              if (!err.message?.includes("detaching") && !err.message?.includes("detached")) {
                console.error("Failed to update presence:", err);
              }
            });
        });
        return;
      }
      
      // Ensure channel is attached before entering presence
      if (channelState === "attached") {
        // Channel already attached, enter presence directly
        const presenceData: PresenceData = {
          userId,
          status,
          lastSeen: Date.now(),
        };

        channel.presence.enter(presenceData)
          .then(() => {
            console.log(`Presence updated: ${userId} is now ${status}`);
          })
          .catch((err) => {
            // Ignore errors if channel state changed during operation
            if (!err.message?.includes("detaching") && !err.message?.includes("detached")) {
              console.error("Failed to update presence:", err);
            }
          });
      } else if (channelState === "initialized" || channelState === "attaching") {
        // Attach channel first if not already attached/attaching
        channel.attach((err) => {
          if (err) {
            console.error("Failed to attach channel for presence update:", err);
            return;
          }

          const presenceData: PresenceData = {
            userId,
            status,
            lastSeen: Date.now(),
          };

          // Enter or update presence using promise
          channel.presence.enter(presenceData)
            .then(() => {
              console.log(`Presence updated: ${userId} is now ${status}`);
            })
            .catch((err) => {
              // Ignore errors if channel state changed during operation
              if (!err.message?.includes("detaching") && !err.message?.includes("detached")) {
                console.error("Failed to update presence:", err);
              }
            });
        });
      }
    },
    [client, userId]
  );

  const leavePresence = useCallback(() => {
    if (!client || !userId) {
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    const channelState = channel.state;
    
    // Don't perform operations if channel is already detaching or detached
    if (channelState === "detaching" || channelState === "detached") {
      return;
    }
    
    // Only try to leave if channel is attached
    if (channelState === "attached") {
      // Leave presence without data (Ably will automatically remove the client)
      channel.presence.leave().catch((err) => {
        // Ignore errors if channel is already detached or in transition
        const errorMsg = err?.message || String(err);
        if (errorMsg && 
            !errorMsg.includes("superseded") && 
            !errorMsg.includes("detached") && 
            !errorMsg.includes("detaching")) {
          console.error("Failed to leave presence:", err);
        }
      });
    }
    
    // Detach channel if it's attached or attaching (but not if already detaching/detached)
    if (channelState === "attached" || channelState === "attaching") {
      try {
        channel.detach((err) => {
          // Ignore errors if channel is already detached or in transition
          const errorMsg = err?.message || String(err);
          if (errorMsg && 
              !errorMsg.includes("superseded") && 
              !errorMsg.includes("detached") && 
              !errorMsg.includes("detaching")) {
            console.error("Failed to detach channel:", err);
          }
        });
      } catch (err: any) {
        // Ignore errors if channel is already detached or in transition
        const errorMsg = err?.message || String(err);
        if (errorMsg && 
            !errorMsg.includes("superseded") && 
            !errorMsg.includes("detached") && 
            !errorMsg.includes("detaching")) {
          console.error("Error detaching channel:", err);
        }
      }
    }
  }, [client, userId]);

  return { updatePresence, leavePresence };
}

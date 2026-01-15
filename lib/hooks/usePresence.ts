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
    // Ensure userId is a string for consistent matching
    const userIdString = userId ? String(userId) : undefined;
    
    if (!client || !userIdString || !isConnected) {
      setIsLoading(false);
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    let mounted = true;

    // Attach to channel first (required for presence operations)
    channel.attach((err: any) => {
      if (err || !mounted) {
        setIsLoading(false);
        return;
      }

      // Subscribe to presence events for this user
      const handlePresenceMessage = (message: any) => {
        if (!mounted) return;
        
        // Ensure both IDs are strings for comparison
        const messageClientId = String(message.clientId || "");
        
        // Debug: log all presence messages to see what we're receiving
        console.log(`[usePresence] Presence message for tracking userId: ${userIdString}`, {
          messageClientId,
          trackingUserId: userIdString,
          match: messageClientId === userIdString,
          action: message.action,
          data: message.data,
        });

        // Only process messages for the user we're tracking
        if (messageClientId !== userIdString) return;

        if (message.action === "enter" || message.action === "update") {
          const data = message.data as PresenceData;
          console.log(`[usePresence] Setting presence for ${userIdString}:`, data);
          setPresence(data);
          setIsLoading(false);
        } else if (message.action === "leave") {
          console.log(`[usePresence] User ${userIdString} left presence`);
          setPresence({
            userId: userIdString,
            status: "offline",
            lastSeen: Date.now(),
          });
          setIsLoading(false);
        }
      };

      // Get current presence state
      channel.presence.get((err: any, members: any) => {
        if (err || !mounted) {
          setIsLoading(false);
          return;
        }

        console.log(`[usePresence] Getting presence for userId: ${userIdString}`, {
          totalMembers: members?.length || 0,
          memberClientIds: members?.map((m: any) => String(m.clientId || "")) || [],
          lookingFor: userIdString,
        });

        // Compare as strings to ensure matching
        const member = members?.find((m: any) => String(m.clientId || "") === userIdString);
        if (member && member.data) {
          console.log(`[usePresence] Found presence for ${userIdString}:`, member.data);
          setPresence(member.data as PresenceData);
        } else {
          console.log(`[usePresence] No presence found for ${userIdString}, setting offline`);
          setPresence({
            userId: userIdString,
            status: "offline",
            lastSeen: Date.now(),
          });
        }
        setIsLoading(false);
      });

      // Subscribe to presence updates
      channel.presence.subscribe(handlePresenceMessage);

      return () => {
        if (mounted) {
          channel.presence.unsubscribe(handlePresenceMessage);
        }
      };
    });

    return () => {
      mounted = false;
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

    // Attach to channel first (required for presence operations)
    channel.attach((err: any) => {
      if (err || !mounted) {
        setIsLoading(false);
        return;
      }

      const updatePresences = () => {
        channel.presence.get((err: any, members: any) => {
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
          members?.forEach((member: any) => {
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
        if (mounted) {
          channel.presence.unsubscribe(handlePresenceMessage);
        }
      };
    });

    return () => {
      mounted = false;
    };
  }, [client, userIds.join(","), isConnected]);

  return { presences, isLoading };
}

export function useUpdatePresence() {
  const { client, isConnected, userId: currentUserId } = usePresenceContext();

  // Update presence for the current user (sender)
  const updatePresence = useCallback(
    (status: PresenceStatus = "online", targetUserId?: string) => {
      // Use targetUserId if provided, otherwise use current user's ID
      const userIdToUpdate = targetUserId || currentUserId;
      
      if (!client || !isConnected || !userIdToUpdate) {
        console.warn(`[updatePresence] Cannot update: client=${!!client}, connected=${isConnected}, userId=${userIdToUpdate}`);
        return;
      }

      // Only allow updating presence for the current user (security)
      // The current user's Ably clientId must match the userId being updated
      if (userIdToUpdate !== currentUserId) {
        console.warn(`[updatePresence] Cannot update presence for different user. Current: ${currentUserId}, Target: ${userIdToUpdate}`);
        return;
      }

      const channel = client.channels.get(PRESENCE_CHANNEL);
      
      console.log(`[updatePresence] Entering presence for userId: ${userIdToUpdate}`, {
        status,
        currentUserId,
        targetUserId,
        clientConnectionId: client.connection.id,
        channelState: channel.state,
      });
      
      // Ensure channel is attached before entering presence
      if (channel.state === "attached") {
        const presenceData: PresenceData = {
          userId: userIdToUpdate,
          status,
          lastSeen: Date.now(),
        };

        // Enter or update presence using promise
        channel.presence.enter(presenceData)
          .then(() => {
            console.log(`[updatePresence] Successfully entered presence for ${userIdToUpdate}`);
          })
          .catch((err: any) => {
            console.error(`[updatePresence] Failed to update presence for ${userIdToUpdate}:`, err);
          });
      } else {
        // Attach channel first, then enter presence
        channel.attach((err: any) => {
          if (err) {
            console.error("Failed to attach channel for presence update:", err);
            return;
          }

          const presenceData: PresenceData = {
            userId: userIdToUpdate,
            status,
            lastSeen: Date.now(),
          };

          channel.presence.enter(presenceData)
            .then(() => {
              console.log(`[updatePresence] Successfully entered presence for ${userIdToUpdate} after attach`);
            })
            .catch((err: any) => {
              console.error(`[updatePresence] Failed to update presence for ${userIdToUpdate}:`, err);
            });
        });
      }
    },
    [client, isConnected, currentUserId]
  );

  const leavePresence = useCallback(() => {
    if (!client || !isConnected || !currentUserId) {
      return;
    }

    const channel = client.channels.get(PRESENCE_CHANNEL);
    // Leave presence without data (Ably will automatically remove the client)
    channel.presence.leave().catch((err: any) => {
      console.error("Failed to leave presence:", err);
    });
  }, [client, isConnected, currentUserId]);

  return { updatePresence, leavePresence };
}

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAblyClient } from "@/lib/presence/ablyClient";

interface PresenceContextType {
  client: any; // Ably.Realtime type
  isConnected: boolean;
  userId: string | undefined;
}

const PresenceContext = createContext<PresenceContextType>({
  client: null,
  isConnected: false,
  userId: undefined,
});

export function usePresenceContext() {
  return useContext(PresenceContext);
}

interface PresenceProviderProps {
  children: ReactNode;
}

export function PresenceProvider({ children }: PresenceProviderProps) {
  const currentUser = useQuery(api.users.current);
  const [client, setClient] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const userId = currentUser?._id;

  useEffect(() => {
    if (!userId) {
      setClient(null);
      setIsConnected(false);
      return;
    }

    let mounted = true;

    // Initialize Ably client asynchronously
    getAblyClient(userId.toString()).then((ablyClient) => {
      if (!mounted || !ablyClient) {
        console.warn("PresenceProvider: Failed to get Ably client", { userId, hasClient: !!ablyClient });
        setClient(null);
        setIsConnected(false);
        return;
      }

      console.log("PresenceProvider: Ably client initialized", {
        userId,
        connectionState: ablyClient.connection.state,
      });

      // Set up connection event handlers
      const handleConnected = () => {
        console.log("PresenceProvider: Ably connected");
        if (mounted) {
          setIsConnected(true);
        }
      };

      const handleDisconnected = () => {
        console.log("PresenceProvider: Ably disconnected");
        if (mounted) {
          setIsConnected(false);
        }
      };

      const handleClosed = () => {
        console.log("PresenceProvider: Ably closed");
        if (mounted) {
          setIsConnected(false);
        }
      };

      const handleFailed = () => {
        console.error("PresenceProvider: Ably connection failed");
        if (mounted) {
          setIsConnected(false);
        }
      };

      ablyClient.connection.on("connected", handleConnected);
      ablyClient.connection.on("disconnected", handleDisconnected);
      ablyClient.connection.on("closed", handleClosed);
      ablyClient.connection.on("failed", handleFailed);

      // Check if already connected
      const initialState = ablyClient.connection.state;
      console.log("PresenceProvider: Ably client state:", initialState);
      
      if (initialState === "connected") {
        setIsConnected(true);
      } else if (initialState === "failed" || initialState === "closed") {
        console.error(`PresenceProvider: Ably client in ${initialState} state, connection failed`);
        setIsConnected(false);
      } else {
        // Log current state and wait for connection
        console.log("PresenceProvider: Waiting for connection, current state:", initialState);
        
        // Set a timeout to warn if connection takes too long
        const connectionTimeout = setTimeout(() => {
          if (mounted && ablyClient.connection.state !== "connected") {
            console.warn(`PresenceProvider: Connection timeout after 10s, state: ${ablyClient.connection.state}`);
          }
        }, 10000);
        
        // Clear timeout when connected
        const handleConnectedForTimeout = () => {
          clearTimeout(connectionTimeout);
          ablyClient.connection.off("connected", handleConnectedForTimeout);
        };
        ablyClient.connection.on("connected", handleConnectedForTimeout);
      }

      setClient(ablyClient);

      return () => {
        ablyClient.connection.off("connected", handleConnected);
        ablyClient.connection.off("disconnected", handleDisconnected);
        ablyClient.connection.off("closed", handleClosed);
        ablyClient.connection.off("failed", handleFailed);
      };
    }).catch((error) => {
      console.error("PresenceProvider: Error initializing Ably client:", error);
      if (mounted) {
        setClient(null);
        setIsConnected(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <PresenceContext.Provider value={{ client, isConnected, userId: userId?.toString() }}>
      {children}
    </PresenceContext.Provider>
  );
}

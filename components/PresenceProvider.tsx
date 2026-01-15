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
        setClient(null);
        setIsConnected(false);
        return;
      }

      // Set up connection event handlers
      const handleConnected = () => {
        if (mounted) {
          setIsConnected(true);
        }
      };

      const handleDisconnected = () => {
        if (mounted) {
          setIsConnected(false);
        }
      };

      const handleClosed = () => {
        if (mounted) {
          setIsConnected(false);
        }
      };

      ablyClient.connection.on("connected", handleConnected);
      ablyClient.connection.on("disconnected", handleDisconnected);
      ablyClient.connection.on("closed", handleClosed);

      // Check if already connected
      if (ablyClient.connection.state === "connected") {
        setIsConnected(true);
      }

      setClient(ablyClient);

      return () => {
        ablyClient.connection.off("connected", handleConnected);
        ablyClient.connection.off("disconnected", handleDisconnected);
        ablyClient.connection.off("closed", handleClosed);
      };
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

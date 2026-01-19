"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  startTransition,
  ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAblyClient } from "@/lib/presence/ablyClient";
import { Realtime } from "ably";

interface PresenceContextType {
  client: Realtime | null;
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
  const [client, setClient] = useState<Realtime | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const userId = currentUser?._id;
  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    // Reset state only when userId changes from valid to null
    if (!userId && prevUserIdRef.current) {
      startTransition(() => {
        setClient(null);
        setIsConnected(false);
      });
      prevUserIdRef.current = userId;
      return;
    }

    if (!userId) {
      prevUserIdRef.current = userId;
      return;
    }

    prevUserIdRef.current = userId;
    let mounted = true;
    let cleanupClient: (() => void) | undefined;

    // Initialize Ably client asynchronously
    getAblyClient(userId.toString()).then((ablyClient) => {
      if (!mounted || !ablyClient) {
        startTransition(() => {
          setClient(null);
          setIsConnected(false);
        });
        return;
      }

      // Set up connection event handlers
      const handleConnected = () => {
        if (mounted) {
          startTransition(() => {
            setIsConnected(true);
          });
        }
      };

      const handleDisconnected = () => {
        if (mounted) {
          startTransition(() => {
            setIsConnected(false);
          });
        }
      };

      const handleClosed = () => {
        if (mounted) {
          startTransition(() => {
            setIsConnected(false);
          });
        }
      };

      ablyClient.connection.on("connected", handleConnected);
      ablyClient.connection.on("disconnected", handleDisconnected);
      ablyClient.connection.on("closed", handleClosed);

      // Re-check mounted before setState (component may have unmounted during getAblyClient)
      if (!mounted) {
        ablyClient.connection.off("connected", handleConnected);
        ablyClient.connection.off("disconnected", handleDisconnected);
        ablyClient.connection.off("closed", handleClosed);
        return;
      }

      // Check if already connected
      if (ablyClient.connection.state === "connected") {
        startTransition(() => {
          setIsConnected(true);
        });
      }

      setClient(ablyClient as unknown as Realtime);

      cleanupClient = () => {
        startTransition(() => {
          setClient(null);
          setIsConnected(false);
        });
        ablyClient.connection.off("connected", handleConnected);
        ablyClient.connection.off("disconnected", handleDisconnected);
        ablyClient.connection.off("closed", handleClosed);
      };
    });

    return () => {
      mounted = false;
      cleanupClient?.();
    };
  }, [userId]);

  return (
    <PresenceContext.Provider
      value={{ client, isConnected, userId: userId?.toString() }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

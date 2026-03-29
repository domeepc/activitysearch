"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";

export interface ChatHeaderData {
  displayName: string;
  username?: string;
  teamId?: Id<"teams">;
  teamIcon?: string;
  isTeam?: boolean;
}

interface ChatHeaderStateContextValue {
  headerData: ChatHeaderData | null;
  setHeaderData: (data: ChatHeaderData) => void;
  clearHeaderData: () => void;
}

const ChatHeaderStateContext = createContext<ChatHeaderStateContextValue | null>(
  null
);

export function ChatHeaderStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [headerData, setHeaderDataState] = useState<ChatHeaderData | null>(null);

  const setHeaderData = useCallback((data: ChatHeaderData) => {
    setHeaderDataState((prev) => {
      if (
        prev &&
        prev.displayName === data.displayName &&
        prev.username === data.username &&
        prev.teamId === data.teamId &&
        prev.teamIcon === data.teamIcon &&
        prev.isTeam === data.isTeam
      ) {
        return prev;
      }
      return data;
    });
  }, []);

  const clearHeaderData = useCallback(() => {
    setHeaderDataState((prev) => (prev === null ? prev : null));
  }, []);

  const value = useMemo<ChatHeaderStateContextValue>(
    () => ({
      headerData,
      setHeaderData,
      clearHeaderData,
    }),
    [headerData, setHeaderData, clearHeaderData]
  );

  return (
    <ChatHeaderStateContext.Provider value={value}>
      {children}
    </ChatHeaderStateContext.Provider>
  );
}

export function useChatHeaderState() {
  const context = useContext(ChatHeaderStateContext);
  if (!context) {
    throw new Error("useChatHeaderState must be used within ChatHeaderStateProvider");
  }
  return context;
}

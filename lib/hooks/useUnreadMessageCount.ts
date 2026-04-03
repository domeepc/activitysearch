import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useUnreadMessageCount() {
  const { isLoaded, isSignedIn } = useAuth();
  const count = useQuery(
    api.messages.getUnreadMessageCount,
    isLoaded && isSignedIn ? {} : "skip"
  );

  return {
    count: count ?? 0,
    isLoading: isSignedIn && count === undefined,
  };
}

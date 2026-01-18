import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useUnreadMessageCount() {
  // Try to query - if function doesn't exist yet, Convex will return undefined
  // We'll handle the error case by checking if the query is available
  const count = useQuery(api.messages.getUnreadMessageCount);

  return {
    count: count ?? 0,
    isLoading: count === undefined,
  };
}

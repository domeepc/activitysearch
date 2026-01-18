import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Hook to check if the current user is an organiser
 * @returns Object with isOrganizer boolean and loading state
 */
export function useOrganizer() {
  const currentUser = useQuery(api.users.current);
  const isOrganizer = currentUser?.role === "organiser" || false;

  return {
    isOrganizer,
    isLoading: currentUser === undefined,
  };
}


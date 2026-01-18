import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Hook to check if the current user is an organiser
 * @returns Object with isOrganiser boolean and loading state
 */
export function useOrganiser() {
  const currentUser = useQuery(api.users.current);
  const isOrganiser = currentUser?.role === "organiser" || false;

  return {
    isOrganiser,
    isLoading: currentUser === undefined,
  };
}


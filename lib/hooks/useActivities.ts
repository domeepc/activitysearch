import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { ActivityData } from "@/lib/types/activity";
import { mapActivityFromDb } from "@/lib/activities";

/**
 * Hook to fetch and transform activities from Convex
 * @returns Object with activities array and loading state
 */
export function useActivities() {
  const activitiesFromDb = useQuery(api.activity.getActivities) as
    | Doc<"activities">[]
    | undefined;

  const activities = useMemo(() => {
    if (!activitiesFromDb) return [];

    return activitiesFromDb.map((doc) => mapActivityFromDb(doc));
  }, [activitiesFromDb]) as ActivityData[];

  return {
    activities,
    isLoading: activitiesFromDb === undefined,
  };
}


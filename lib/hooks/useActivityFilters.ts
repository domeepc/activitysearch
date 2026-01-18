import { useMemo } from "react";
import { ActivityData } from "@/lib/types/activity";
import { filterActivitiesByCategories } from "@/lib/activities";

/**
 * Hook to filter activities based on selected categories
 * @param activities - Array of activities to filter
 * @param selectedCategories - Array of selected category/tag names
 * @returns Object with filtered activities array
 */
export function useActivityFilters(
  activities: ActivityData[],
  selectedCategories: string[]
) {
  const filteredActivities = useMemo(() => {
    return filterActivitiesByCategories(activities, selectedCategories);
  }, [activities, selectedCategories]);

  return {
    filteredActivities,
  };
}


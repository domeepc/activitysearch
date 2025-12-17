"use client";

import ActivityFilters from "./ActivityFilters";
import AddActivityButton from "./AddActivityButton";
import { ActivityData } from "@/lib/types/activity";

interface DesktopFilterSectionProps {
  activities: ActivityData[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
  onAddActivity: () => void;
  isOrganizer: boolean;
}

export default function DesktopFilterSection({
  activities,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
  onAddActivity,
  isOrganizer,
}: DesktopFilterSectionProps) {
  return (
    <section className="hidden md:block">
      <div className="filter_tab">
        <ActivityFilters
          activities={activities}
          selectedCategories={selectedCategories}
          onCategoryChange={onCategoryChange}
          onActivitySelect={onActivitySelect}
        />
        {isOrganizer && (
          <AddActivityButton
            onClick={onAddActivity}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700"
          />
        )}
      </div>
    </section>
  );
}


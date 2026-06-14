"use client";

import { MapPin, Plus, SlidersHorizontal } from "lucide-react";
import SearchAutocomplete from "@/components/ui/search-autocomplete";
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectValue,
  MultiSelectGroup,
  MultiSelectItem,
} from "@/components/ui/multi-select";
import { ActivityData } from "@/lib/types/activity";
import { getUniqueCategories } from "@/lib/activities";
import { cn } from "@/lib/utils";

interface DesktopFilterSectionProps {
  activities: ActivityData[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
  onClearSelection?: () => void;
  onAddActivity: () => void;
  isOrganiser: boolean;
}

export default function DesktopFilterSection({
  activities,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
  onClearSelection,
  onAddActivity,
  isOrganiser,
}: DesktopFilterSectionProps) {
  const uniqueCategories = getUniqueCategories(activities);

  return (
    <section className="hidden md:block" style={{ position: "relative", zIndex: 10, margin: "1.5rem" }}>
      <div
        className={cn(
          "w-72 flex flex-col",
          "bg-muted/95 backdrop-blur-sm",
          "rounded-2xl border border-border/80",
          "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.10),0_1px_4px_-1px_rgba(0,0,0,0.06)]"
        )}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="flex items-center justify-center size-7 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <MapPin className="size-3.5 text-blue-600" />
            </div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">
              Find Activities
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground pl-9">
            {activities.length} {activities.length === 1 ? "activity" : "activities"} available
          </p>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-3">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <SlidersHorizontal className="size-3" />
            Search
          </label>
          <SearchAutocomplete
            activities={activities}
            onActivitySelect={onActivitySelect}
            onClearSelection={onClearSelection}
            placeholder="Activity or location..."
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-4" />

        {/* Categories */}
        <div className="px-4 pt-3 pb-4">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <span className="size-3 rounded-full border-2 border-zinc-300 inline-block" />
            Category
          </label>
          <MultiSelect
            values={selectedCategories}
            onValuesChange={onCategoryChange}
          >
            <MultiSelectTrigger className="w-full">
              <MultiSelectValue placeholder="All categories" />
            </MultiSelectTrigger>
            {uniqueCategories.length > 0 && (
              <MultiSelectContent search={false} className="filter_tab_content">
                <MultiSelectGroup>
                  {uniqueCategories.map((category) => (
                    <MultiSelectItem key={category} value={category}>
                      {category}
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            )}
          </MultiSelect>
        </div>

        {/* Add Activity */}
        {isOrganiser && (
          <div className="px-4 pb-4">
            <div className="h-px bg-border mb-3" />
            <button
              onClick={onAddActivity}
              className={cn(
                "w-full flex items-center justify-center gap-2",
                "py-2.5 rounded-xl",
                "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]",
                "text-white text-sm font-semibold",
                "transition-all duration-150",
                "shadow-[0_2px_8px_-2px_rgba(37,99,235,0.4)]"
              )}
            >
              <Plus className="size-4" />
              Add Activity
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

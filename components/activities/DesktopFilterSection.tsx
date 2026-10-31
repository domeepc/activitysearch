"use client";

import Image from "next/image";
import { Plus, Star } from "lucide-react";
import SearchAutocomplete from "@/components/ui/search-autocomplete";
import { ActivityData } from "@/lib/types/activity";
import { getUniqueCategories } from "@/lib/activities";
import { cn, formatPrice } from "@/lib/utils";

interface DesktopFilterSectionProps {
  activities: ActivityData[];
  results: ActivityData[];
  selectedActivityId: string | null;
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
  onResultSelect: (activity: ActivityData) => void;
  onClearSelection?: () => void;
  onAddActivity: () => void;
  isOrganiser: boolean;
}

/** Desktop side panel next to the map: search, category chips and the result list. */
export default function DesktopFilterSection({
  activities,
  results,
  selectedActivityId,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
  onResultSelect,
  onClearSelection,
  onAddActivity,
  isOrganiser,
}: DesktopFilterSectionProps) {
  const categories = getUniqueCategories(activities);
  const isFiltered = selectedCategories.length > 0;

  const toggleCategory = (category: string) => {
    onCategoryChange(
      selectedCategories.includes(category)
        ? selectedCategories.filter((c) => c !== category)
        : [...selectedCategories, category]
    );
  };

  return (
    <aside
      aria-label="Find activities"
      className="hidden w-[380px] shrink-0 flex-col border-r border-border bg-white md:flex dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight">Explore</h1>
          <p className="text-[13px] tabular-nums text-muted-foreground" aria-live="polite">
            {isFiltered
              ? `${results.length} of ${activities.length} activities`
              : `${activities.length} ${activities.length === 1 ? "activity" : "activities"}`}
          </p>
        </div>
        <SearchAutocomplete
          activities={activities}
          onActivitySelect={onActivitySelect}
          onClearSelection={onClearSelection}
          placeholder="Search activity or location…"
        />
        {categories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Categories">
            {categories.map((category) => {
              const active = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCategory(category)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] transition-colors active:scale-[0.97]",
                    active
                      ? "border-blue-600 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : "border-border text-foreground hover:bg-muted"
                  )}
                >
                  {category}
                </button>
              );
            })}
            {isFiltered ? (
              <button
                type="button"
                onClick={() => onCategoryChange([])}
                className="h-8 px-2 text-[13px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {results.length === 0 ? (
          <li className="px-2 py-10 text-center text-sm text-muted-foreground">
            No activities match these filters.
          </li>
        ) : (
          results.map((activity) => {
            const selected = activity.id === selectedActivityId;
            const image = activity.images?.[0];
            return (
              <li key={activity.id}>
                <button
                  type="button"
                  onClick={() => onResultSelect(activity)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "flex w-full gap-3 rounded-2xl border p-3 text-left transition-colors",
                    selected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-transparent hover:bg-muted"
                  )}
                >
                  <span className="relative h-[84px] w-[100px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    {image ? (
                      <Image src={image} alt="" fill sizes="100px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {activity.tags?.[0] ?? activity.category}
                    </span>
                    <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{activity.title}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {[activity.duration, activity.difficulty].filter(Boolean).join(" · ")}
                      <span aria-hidden="true">·</span>
                      <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                      {activity.rating.toFixed(1)}
                    </span>
                    <span className="mt-auto text-[13px]">
                      <span className="text-muted-foreground">From </span>
                      <b>{formatPrice(activity.price.amount)}</b>
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {isOrganiser ? (
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onAddActivity}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add activity
          </button>
        </div>
      ) : null}
    </aside>
  );
}

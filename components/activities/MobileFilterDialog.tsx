"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import SearchAutocomplete from "@/components/ui/search-autocomplete";
import { getUniqueCategories } from "@/lib/activities";
import { ActivityData } from "@/lib/types/activity";
import { cn } from "@/lib/utils";

interface MobileFilterDialogProps {
  activities: ActivityData[];
  resultCount: number;
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
  onClearSelection?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: () => void;
  /** Organisers get a round "+" next to the search pill. */
  onAddActivity?: () => void;
}

/** Phone-only dock over the map (search pill + add button) and the search sheet it opens. */
export default function MobileFilterDialog({
  activities,
  resultCount,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
  onClearSelection,
  open,
  onOpenChange,
  onSearch,
  onAddActivity,
}: MobileFilterDialogProps) {
  const categories = getUniqueCategories(activities);
  const filterCount = selectedCategories.length;
  const toggle = (c: string) =>
    onCategoryChange(selectedCategories.includes(c) ? selectedCategories.filter((x) => x !== c) : [...selectedCategories, c]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2 md:hidden">
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 pl-4 pr-2 text-left shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur transition-transform active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/95"
          >
            <Search className="size-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">Find activities</b>
              <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">
                {filterCount > 0 ? selectedCategories.join(", ") : `${activities.length} near you · any category`}
              </span>
            </span>
            <span
              className={cn(
                "relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
                filterCount > 0 ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              )}
              aria-hidden="true"
            >
              <SlidersHorizontal className="size-4" />
              {filterCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-[10px] font-bold text-white dark:border-zinc-900">
                  {filterCount}
                </span>
              )}
            </span>
          </button>
        </DialogPrimitive.Trigger>
        {onAddActivity && (
          <button
            type="button"
            onClick={onAddActivity}
            aria-label="Add activity"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_12px_32px_-12px_rgba(37,99,235,0.7)] transition-transform hover:bg-blue-700 active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        )}
      </div>

      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.3)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full duration-300 ease-drawer dark:bg-zinc-900"
        >
          <div className="flex justify-center pt-3" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          </div>
          <div className="flex items-center gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg font-bold tracking-tight">Find activities</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-zinc-600 dark:text-zinc-400">
                Search by name or place, or narrow by category.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4">
            <SearchAutocomplete
              activities={activities}
              onActivitySelect={onActivitySelect}
              onClearSelection={onClearSelection}
              placeholder="Activity, town or address"
            />
            {categories.length > 0 && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 flex w-full items-baseline justify-between text-sm font-semibold">
                  Categories
                  {filterCount > 0 && (
                    <button type="button" onClick={() => onCategoryChange([])} className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Clear
                    </button>
                  )}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const on = selectedCategories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(c)}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                          on
                            ? "border-blue-600 bg-blue-600 font-medium text-white"
                            : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        )}
                      >
                        {on && <Check className="size-4" aria-hidden="true" />}
                        {c}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-zinc-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                onCategoryChange([]);
                onClearSelection?.();
              }}
              className="h-12 rounded-xl px-4 text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={onSearch}
              className="h-12 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-blue-700 active:scale-[0.99]"
            >
              Show {resultCount} {resultCount === 1 ? "activity" : "activities"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

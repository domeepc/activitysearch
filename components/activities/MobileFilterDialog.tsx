"use client";

import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogOverlay,
  DialogClose,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, SlidersHorizontal, X } from "lucide-react";
import ActivityFilters from "./ActivityFilters";
import { ActivityData } from "@/lib/types/activity";
import { cn } from "@/lib/utils";

interface MobileFilterDialogProps {
  activities: ActivityData[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
  onClearSelection?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: () => void;
}

export default function MobileFilterDialog({
  activities,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
  onClearSelection,
  open,
  onOpenChange,
  onSearch,
}: MobileFilterDialogProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Trigger asChild>
          <button
            className={cn(
              "group flex items-center gap-2.5 px-6 py-3.5",
              "rounded-full",
              "bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700",
              "text-white font-semibold text-sm tracking-wide",
              "shadow-[0_8px_32px_-4px_rgba(59,130,246,0.5)]",
              "hover:shadow-[0_12px_40px_-4px_rgba(59,130,246,0.65)]",
              "hover:scale-105 active:scale-95",
              "transition-all duration-200 ease-out",
              "border border-white/10",
              "outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            )}
          >
            <Search className="size-4 group-hover:rotate-12 transition-transform duration-200" />
            <span>Find activities</span>
            <div className="ml-0.5 flex items-center justify-center size-5 rounded-full bg-white/20 text-[10px] font-bold">
              <SlidersHorizontal className="size-3" />
            </div>
          </button>
        </DialogPrimitive.Trigger>

        {/* Custom bottom-sheet dialog */}
        <DialogPortal>
          <DialogOverlay className="bg-black/40 backdrop-blur-[2px]" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50",
              "w-full max-w-full",
              "rounded-t-3xl",
              "bg-white",
              "shadow-[0_-8px_60px_-8px_rgba(0,0,0,0.2)]",
              "outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full",
              "duration-300"
            )}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-10 h-1 rounded-full bg-zinc-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-4">
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-zinc-900 tracking-tight">
                  Find activities
                </DialogPrimitive.Title>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {activities.length} activities available
                </p>
              </div>
              <DialogPrimitive.Close className="flex items-center justify-center size-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors">
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-100 mx-5" />

            {/* Filters */}
            <div className="px-5 py-4 flex flex-col gap-2">
              <ActivityFilters
                activities={activities}
                selectedCategories={selectedCategories}
                onCategoryChange={onCategoryChange}
                onActivitySelect={onActivitySelect}
                onClearSelection={onClearSelection}
              />
            </div>

            {/* Footer */}
            <div className="px-5 pb-8 pt-2">
              <button
                onClick={onSearch}
                className={cn(
                  "w-full py-3.5 rounded-full",
                  "bg-gradient-to-r from-blue-500 to-blue-700",
                  "text-white font-semibold text-sm tracking-wide",
                  "shadow-[0_4px_20px_-4px_rgba(59,130,246,0.5)]",
                  "hover:shadow-[0_8px_28px_-4px_rgba(59,130,246,0.65)]",
                  "hover:brightness-110 active:scale-[0.98]",
                  "transition-all duration-150",
                  "flex items-center justify-center gap-2"
                )}
              >
                <Search className="size-4" />
                Search activities
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
